package at.marcel.bergtouren;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.CancellationSignal;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Read-only access to photos and videos already indexed by Android MediaStore.
 * Capture time is preferred. DATE_ADDED is used only when capture time is missing.
 * Original media is never copied, edited, or deleted.
 */
final class GalleryMediaStore {
    static final String ACCESS_FULL = "full";
    static final String ACCESS_PARTIAL = "partial";
    static final String ACCESS_NONE = "none";

    private static final int MAX_RESULTS = 500;
    private static final int THUMBNAIL_EDGE = 480;
    private static final int FULL_IMAGE_EDGE = 2048;

    private GalleryMediaStore() {
    }

    static String getAccessState(Context context) {
        boolean images = canReadImages(context);
        boolean videos = canReadVideos(context);
        if (images && videos && hasFullImagePermission(context)
                && hasFullVideoPermission(context)) {
            return ACCESS_FULL;
        }
        return images || videos ? ACCESS_PARTIAL : ACCESS_NONE;
    }

    private static boolean canReadImages(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return hasPermission(context, Manifest.permission.READ_MEDIA_IMAGES)
                    || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                    && hasPermission(context, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED));
        }
        return hasPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    static boolean hasVideoAccess(Context context) {
        return canReadVideos(context);
    }

    private static boolean canReadVideos(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return hasPermission(context, Manifest.permission.READ_MEDIA_VIDEO)
                    || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                    && hasPermission(context, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED));
        }
        return hasPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    private static boolean hasFullImagePermission(Context context) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? hasPermission(context, Manifest.permission.READ_MEDIA_IMAGES)
                : hasPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    private static boolean hasFullVideoPermission(Context context) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? hasPermission(context, Manifest.permission.READ_MEDIA_VIDEO)
                : hasPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    static JSONObject queryMediaForLocalDate(Context context, String date) throws JSONException {
        JSONObject result = new JSONObject();
        result.put("date", date);

        String access = getAccessState(context);
        result.put("access", access);
        result.put("canSearchEntireLibrary", ACCESS_FULL.equals(access));

        if (ACCESS_NONE.equals(access)) {
            result.put("status", "permission_required");
            result.put("photos", new JSONArray());
            result.put("videos", new JSONArray());
            result.put("media", new JSONArray());
            result.put("count", 0);
            result.put("truncated", false);
            return result;
        }

        final LocalDate localDate;
        try {
            localDate = LocalDate.parse(date);
        } catch (DateTimeParseException | NullPointerException error) {
            throw new IllegalArgumentException("Das Tourdatum muss im Format JJJJ-MM-TT vorliegen.");
        }

        ZoneId zone = ZoneId.systemDefault();
        long startMillis = localDate.atStartOfDay(zone).toInstant().toEpochMilli();
        long endMillis = localDate.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli();

        QueryResult imageResult = canReadImages(context)
                ? queryCollection(context, MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        "photo", startMillis, endMillis)
                : new QueryResult();
        QueryResult videoResult = canReadVideos(context)
                ? queryCollection(context, MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                        "video", startMillis, endMillis)
                : new QueryResult();

        JSONArray photos = new JSONArray();
        JSONArray videos = new JSONArray();
        ArrayList<JSONObject> combined = new ArrayList<>();

        for (JSONObject item : imageResult.items) {
            photos.put(item);
            combined.add(item);
        }
        for (JSONObject item : videoResult.items) {
            videos.put(item);
            combined.add(item);
        }

        Collections.sort(combined, Comparator.comparingLong(GalleryMediaStore::effectiveTimestamp));

        boolean truncated = imageResult.truncated || videoResult.truncated
                || combined.size() > MAX_RESULTS;
        if (combined.size() > MAX_RESULTS) {
            combined.subList(MAX_RESULTS, combined.size()).clear();
        }

        JSONArray media = new JSONArray();
        for (JSONObject item : combined) media.put(item);

        result.put("status", ACCESS_FULL.equals(access) ? "ok" : "partial_results");
        result.put("photos", photos);
        result.put("videos", videos);
        result.put("media", media);
        result.put("count", media.length());
        result.put("truncated", truncated);
        return result;
    }

    private static QueryResult queryCollection(
            Context context,
            Uri collection,
            String mediaType,
            long startMillis,
            long endMillis
    ) {
        QueryResult result = new QueryResult();
        String dateTaken = "datetaken";
        String dateAdded = MediaStore.MediaColumns.DATE_ADDED;
        long startSeconds = startMillis / 1000L;
        long endSeconds = endMillis / 1000L;

        ArrayList<String> projectionList = new ArrayList<>();
        Collections.addAll(projectionList,
                MediaStore.MediaColumns._ID,
                MediaStore.MediaColumns.DISPLAY_NAME,
                dateTaken,
                dateAdded,
                MediaStore.MediaColumns.MIME_TYPE,
                MediaStore.MediaColumns.WIDTH,
                MediaStore.MediaColumns.HEIGHT,
                MediaStore.MediaColumns.SIZE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            projectionList.add(MediaStore.MediaColumns.RELATIVE_PATH);
        }
        if ("video".equals(mediaType)) {
            projectionList.add(MediaStore.Video.VideoColumns.DURATION);
        }

        String selection = "((" + dateTaken + " >= ? AND " + dateTaken + " < ?) OR (("
                + dateTaken + " IS NULL OR " + dateTaken + " <= 0) AND "
                + dateAdded + " >= ? AND " + dateAdded + " < ?))";
        String[] selectionArgs = new String[] {
                Long.toString(startMillis),
                Long.toString(endMillis),
                Long.toString(startSeconds),
                Long.toString(endSeconds)
        };
        String sortOrder = dateTaken + " ASC, " + dateAdded + " ASC, "
                + MediaStore.MediaColumns._ID + " ASC";

        try (Cursor cursor = context.getContentResolver().query(
                collection,
                projectionList.toArray(new String[0]),
                selection,
                selectionArgs,
                sortOrder
        )) {
            if (cursor == null) return result;

            int idColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID);
            int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME);
            int dateColumn = cursor.getColumnIndexOrThrow(dateTaken);
            int dateAddedColumn = cursor.getColumnIndexOrThrow(dateAdded);
            int mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE);
            int widthColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.WIDTH);
            int heightColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.HEIGHT);
            int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE);
            int pathColumn = cursor.getColumnIndex(MediaStore.MediaColumns.RELATIVE_PATH);
            int durationColumn = "video".equals(mediaType)
                    ? cursor.getColumnIndex(MediaStore.Video.VideoColumns.DURATION) : -1;

            while (cursor.moveToNext()) {
                if (result.items.size() >= MAX_RESULTS) {
                    result.truncated = true;
                    break;
                }

                long id = cursor.getLong(idColumn);
                Uri itemUri = Uri.withAppendedPath(collection, Long.toString(id));
                long taken = cursor.isNull(dateColumn) ? 0L : cursor.getLong(dateColumn);
                long addedSeconds = cursor.isNull(dateAddedColumn)
                        ? 0L : cursor.getLong(dateAddedColumn);
                String relativePath = pathColumn >= 0 && !cursor.isNull(pathColumn)
                        ? cursor.getString(pathColumn) : "";

                JSONObject item = new JSONObject();
                item.put("uri", itemUri.toString());
                item.put("mediaType", mediaType);
                item.put("displayName", cursor.isNull(nameColumn)
                        ? JSONObject.NULL : cursor.getString(nameColumn));
                item.put("dateTaken", taken);
                item.put("dateAdded", addedSeconds > 0 ? addedSeconds * 1000L : 0L);
                item.put("dateBasis", taken > 0 ? "capture" : "added");
                item.put("relativePath", relativePath);
                item.put("mimeType", cursor.isNull(mimeColumn)
                        ? JSONObject.NULL : cursor.getString(mimeColumn));
                item.put("width", cursor.isNull(widthColumn)
                        ? JSONObject.NULL : cursor.getInt(widthColumn));
                item.put("height", cursor.isNull(heightColumn)
                        ? JSONObject.NULL : cursor.getInt(heightColumn));
                item.put("sizeBytes", cursor.isNull(sizeColumn)
                        ? JSONObject.NULL : cursor.getLong(sizeColumn));
                if (durationColumn >= 0) {
                    item.put("durationMillis", cursor.isNull(durationColumn)
                            ? 0L : cursor.getLong(durationColumn));
                }
                result.items.add(item);
            }
        } catch (SecurityException error) {
            // A user may revoke partial/full access while the app is running.
            result.items.clear();
        } catch (Exception error) {
            android.util.Log.w("BergtourenAndroid", "MediaStore-Abfrage fehlgeschlagen: " + mediaType, error);
        }
        return result;
    }

    private static long effectiveTimestamp(JSONObject item) {
        long taken = item.optLong("dateTaken", 0L);
        return taken > 0 ? taken : item.optLong("dateAdded", 0L);
    }

    static JSONObject loadThumbnailBase64(Context context, String uriString)
            throws JSONException {
        JSONObject result = new JSONObject();
        Uri uri = parseUri(uriString);
        if (!isAllowedGalleryMediaUri(uri)) {
            result.put("status", "invalid_uri");
            return result;
        }

        boolean video = isAllowedVideoUri(uri);
        if (video ? !canReadVideos(context) : !canReadImages(context)) {
            result.put("status", "permission_required");
            result.put("access", getAccessState(context));
            return result;
        }

        Bitmap bitmap = null;
        try {
            ContentResolver resolver = context.getContentResolver();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                bitmap = resolver.loadThumbnail(
                        uri,
                        new Size(THUMBNAIL_EDGE, THUMBNAIL_EDGE),
                        new CancellationSignal()
                );
            } else if (video) {
                bitmap = decodeVideoFrame(context, uri);
            } else {
                bitmap = decodeScaledThumbnail(resolver, uri, THUMBNAIL_EDGE);
            }
            return encodeBitmapResult(result, bitmap, 78);
        } catch (SecurityException error) {
            result.put("status", "permission_changed");
            result.put("access", getAccessState(context));
            return result;
        } catch (Exception error) {
            result.put("status", "unavailable");
            return result;
        } finally {
            recycle(bitmap);
        }
    }

    static JSONObject loadFullImageBase64(Context context, String uriString)
            throws JSONException {
        JSONObject result = new JSONObject();
        Uri uri = parseUri(uriString);
        if (!isAllowedImageUri(uri)) {
            result.put("status", "invalid_uri");
            return result;
        }
        if (!canReadImages(context)) {
            result.put("status", "permission_required");
            result.put("access", getAccessState(context));
            return result;
        }

        Bitmap bitmap = null;
        try {
            ContentResolver resolver = context.getContentResolver();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                bitmap = resolver.loadThumbnail(
                        uri,
                        new Size(FULL_IMAGE_EDGE, FULL_IMAGE_EDGE),
                        new CancellationSignal()
                );
            } else {
                bitmap = decodeScaledThumbnail(resolver, uri, FULL_IMAGE_EDGE);
            }
            return encodeBitmapResult(result, bitmap, 90);
        } catch (SecurityException error) {
            result.put("status", "permission_changed");
            result.put("access", getAccessState(context));
            return result;
        } catch (Exception error) {
            result.put("status", "unavailable");
            return result;
        } finally {
            recycle(bitmap);
        }
    }

    static boolean isAllowedImageUri(Uri uri) {
        return hasMediaUriSegments(uri, "images");
    }

    static boolean isAllowedVideoUri(Uri uri) {
        return hasMediaUriSegments(uri, "video");
    }

    static boolean isAllowedGalleryMediaUri(Uri uri) {
        return isAllowedImageUri(uri) || isAllowedVideoUri(uri);
    }

    private static boolean hasMediaUriSegments(Uri uri, String type) {
        if (uri == null || !"content".equalsIgnoreCase(uri.getScheme())
                || !"media".equalsIgnoreCase(uri.getAuthority())) {
            return false;
        }
        List<String> segments = uri.getPathSegments();
        if (segments == null || segments.size() != 4
                || !"external".equals(segments.get(0))
                || !type.equals(segments.get(1))
                || !"media".equals(segments.get(2))) {
            return false;
        }
        try {
            return Long.parseLong(segments.get(3)) > 0;
        } catch (NumberFormatException error) {
            return false;
        }
    }

    private static Uri parseUri(String uriString) {
        if (uriString == null || uriString.length() > 512) return null;
        try {
            return Uri.parse(uriString);
        } catch (RuntimeException error) {
            return null;
        }
    }

    private static Bitmap decodeVideoFrame(Context context, Uri uri) throws Exception {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(context, uri);
            return retriever.getFrameAtTime(0L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
        } finally {
            retriever.release();
        }
    }

    private static Bitmap decodeScaledThumbnail(
            ContentResolver resolver,
            Uri uri,
            int maxEdge
    ) throws Exception {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) return null;
            BitmapFactory.decodeStream(input, null, bounds);
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

        int largest = Math.max(bounds.outWidth, bounds.outHeight);
        int sample = 1;
        while (largest / (sample * 2) >= maxEdge) sample *= 2;

        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        options.inPreferredConfig = Bitmap.Config.RGB_565;
        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) return null;
            Bitmap decoded = BitmapFactory.decodeStream(input, null, options);
            if (decoded == null) return null;

            int currentLargest = Math.max(decoded.getWidth(), decoded.getHeight());
            if (currentLargest <= maxEdge) return decoded;

            float ratio = (float) maxEdge / (float) currentLargest;
            Bitmap scaled = Bitmap.createScaledBitmap(
                    decoded,
                    Math.max(1, Math.round(decoded.getWidth() * ratio)),
                    Math.max(1, Math.round(decoded.getHeight() * ratio)),
                    true
            );
            if (scaled != decoded) decoded.recycle();
            return scaled;
        }
    }

    private static JSONObject encodeBitmapResult(JSONObject result, Bitmap bitmap, int quality)
            throws JSONException {
        if (bitmap == null) {
            result.put("status", "unavailable");
            return result;
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        if (!bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)) {
            result.put("status", "thumbnail_failed");
            return result;
        }
        result.put("status", "ok");
        result.put("mimeType", "image/jpeg");
        result.put("data", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
        result.put("width", bitmap.getWidth());
        result.put("height", bitmap.getHeight());
        return result;
    }

    private static void recycle(Bitmap bitmap) {
        if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
    }

    private static boolean hasPermission(Context context, String permission) {
        return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private static final class QueryResult {
        final ArrayList<JSONObject> items = new ArrayList<>();
        boolean truncated;
    }
}
