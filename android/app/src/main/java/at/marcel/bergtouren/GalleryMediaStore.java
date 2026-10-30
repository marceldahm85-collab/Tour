package at.marcel.bergtouren;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;

/**
 * Read-only access to photos already indexed by Android MediaStore.
 *
 * This class never copies, edits, or deletes user media. Queries are restricted
 * to the requested local calendar day and are only executed after the user has
 * granted the corresponding runtime permission.
 */
final class GalleryMediaStore {
    static final String ACCESS_FULL = "full";
    static final String ACCESS_PARTIAL = "partial";
    static final String ACCESS_NONE = "none";

    private static final int MAX_RESULTS = 500;

    private GalleryMediaStore() {
    }

    static String getAccessState(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            if (hasPermission(context, Manifest.permission.READ_MEDIA_IMAGES)) {
                return ACCESS_FULL;
            }
            if (hasPermission(context, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)) {
                return ACCESS_PARTIAL;
            }
            return ACCESS_NONE;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return hasPermission(context, Manifest.permission.READ_MEDIA_IMAGES)
                    ? ACCESS_FULL : ACCESS_NONE;
        }

        return hasPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE)
                ? ACCESS_FULL : ACCESS_NONE;
    }

    static JSONObject queryImagesForLocalDate(Context context, String date)
            throws JSONException {
        JSONObject result = new JSONObject();
        result.put("date", date);

        String access = getAccessState(context);
        result.put("access", access);
        result.put("canSearchEntireLibrary", ACCESS_FULL.equals(access));

        if (ACCESS_NONE.equals(access)) {
            result.put("status", "permission_required");
            result.put("photos", new JSONArray());
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

        String[] projection = new String[] {
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.DATE_TAKEN,
                MediaStore.Images.Media.MIME_TYPE,
                MediaStore.Images.Media.WIDTH,
                MediaStore.Images.Media.HEIGHT,
                MediaStore.Images.Media.SIZE
        };

        String selection = MediaStore.Images.Media.DATE_TAKEN + " >= ? AND "
                + MediaStore.Images.Media.DATE_TAKEN + " < ?";
        String[] selectionArgs = new String[] {
                Long.toString(startMillis),
                Long.toString(endMillis)
        };
        String sortOrder = MediaStore.Images.Media.DATE_TAKEN + " ASC, "
                + MediaStore.Images.Media._ID + " ASC";

        JSONArray photos = new JSONArray();
        boolean truncated = false;
        Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;

        try (Cursor cursor = context.getContentResolver().query(
                collection,
                projection,
                selection,
                selectionArgs,
                sortOrder
        )) {
            if (cursor != null) {
                int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
                int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
                int dateColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_TAKEN);
                int mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE);
                int widthColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH);
                int heightColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT);
                int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE);

                while (cursor.moveToNext()) {
                    if (photos.length() >= MAX_RESULTS) {
                        truncated = true;
                        break;
                    }

                    long id = cursor.getLong(idColumn);
                    Uri itemUri = Uri.withAppendedPath(collection, Long.toString(id));

                    JSONObject photo = new JSONObject();
                    photo.put("uri", itemUri.toString());
                    photo.put("displayName", cursor.isNull(nameColumn)
                            ? JSONObject.NULL : cursor.getString(nameColumn));
                    photo.put("dateTaken", cursor.getLong(dateColumn));
                    photo.put("mimeType", cursor.isNull(mimeColumn)
                            ? JSONObject.NULL : cursor.getString(mimeColumn));
                    photo.put("width", cursor.isNull(widthColumn)
                            ? JSONObject.NULL : cursor.getInt(widthColumn));
                    photo.put("height", cursor.isNull(heightColumn)
                            ? JSONObject.NULL : cursor.getInt(heightColumn));
                    photo.put("sizeBytes", cursor.isNull(sizeColumn)
                            ? JSONObject.NULL : cursor.getLong(sizeColumn));
                    photos.put(photo);
                }
            }
        } catch (SecurityException error) {
            // Permission can be changed in Android settings while the app is open.
            result.put("status", "permission_changed");
            result.put("access", getAccessState(context));
            result.put("photos", new JSONArray());
            result.put("count", 0);
            result.put("truncated", false);
            return result;
        }

        result.put("status", ACCESS_PARTIAL.equals(access)
                ? "partial_results" : "ok");
        result.put("photos", photos);
        result.put("count", photos.length());
        result.put("truncated", truncated);
        return result;
    }

    private static boolean hasPermission(Context context, String permission) {
        return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }
}
