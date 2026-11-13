package at.marcel.bergtouren;

import android.content.ContentResolver;
import android.content.Context;
import android.content.UriPermission;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.exifinterface.media.ExifInterface;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;

/** Read-only access to images in a user-selected SAF folder tree. */
final class GalleryTreePhotos {
    private static final int MAX_IMAGES=400, THUMB_EDGE=420, FULL_EDGE=2400;
    private GalleryTreePhotos() {}

    static String getFolderName(Context context, Uri tree) {
        try {
            String id=DocumentsContract.getTreeDocumentId(tree);
            Uri doc=DocumentsContract.buildDocumentUriUsingTree(tree,id);
            try(Cursor c=context.getContentResolver().query(doc,new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)) {
                if(c!=null&&c.moveToFirst()) return c.getString(0);
            }
        } catch(Exception ignored) {}
        return "Ausgewählter Ordner";
    }

    static JSONObject queryImages(Context context,String value) throws JSONException {
        JSONObject out=new JSONObject(); JSONArray images=new JSONArray(); out.put("images",images);
        Uri tree=parseTree(value);
        if(tree==null||!hasTreePermission(context,tree)){out.put("status","permission_changed");return out;}
        ArrayDeque<String> queue=new ArrayDeque<>(); queue.add(DocumentsContract.getTreeDocumentId(tree));
        ArrayList<JSONObject> found=new ArrayList<>(); int visited=0;
        while(!queue.isEmpty()&&found.size()<MAX_IMAGES&&visited<2500) {
            String parent=queue.removeFirst(); visited++;
            Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,parent);
            try(Cursor c=context.getContentResolver().query(children,new String[]{
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,DocumentsContract.Document.COLUMN_LAST_MODIFIED,
                DocumentsContract.Document.COLUMN_SIZE},null,null,DocumentsContract.Document.COLUMN_DISPLAY_NAME+" ASC")) {
                if(c==null) continue;
                int idc=c.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
                int nc=c.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
                int mc=c.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE);
                int dc=c.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED);
                int sc=c.getColumnIndex(DocumentsContract.Document.COLUMN_SIZE);
                while(c.moveToNext()&&found.size()<MAX_IMAGES) {
                    String id=c.getString(idc),mime=c.getString(mc); if(id==null||mime==null)continue;
                    if(DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)){if(visited+queue.size()<2500)queue.addLast(id);}
                    else if(mime.toLowerCase(java.util.Locale.ROOT).startsWith("image/")) {
                        JSONObject item=new JSONObject();
                        item.put("uri",DocumentsContract.buildDocumentUriUsingTree(tree,id).toString());
                        item.put("displayName",nc>=0?c.getString(nc):"");
                        item.put("mimeType",mime);
                        item.put("lastModified",dc>=0&&!c.isNull(dc)?c.getLong(dc):0L);
                        item.put("sizeBytes",sc>=0&&!c.isNull(sc)?c.getLong(sc):0L);
                        found.add(item);
                    }
                }
            } catch(SecurityException e){out.put("status","permission_changed");return out;}
            catch(Exception e){android.util.Log.w("BergtourenAndroid","SAF-Unterordner konnte nicht gelesen werden.",e);}
        }
        Collections.sort(found,Comparator.comparingLong(item->item.optLong("lastModified",0L)));
        for(JSONObject item:found)images.put(item);
        out.put("status","ok");out.put("count",images.length());out.put("truncated",!queue.isEmpty()||found.size()>=MAX_IMAGES);
        out.put("folderName",getFolderName(context,tree));return out;
    }

    static JSONObject readDateTaken(Context context,String value)throws JSONException {
        JSONObject out=new JSONObject();
        Uri uri=parseDocument(value);
        if(uri==null||!hasDocumentPermission(context,uri)){out.put("status","permission_changed");return out;}
        try(InputStream in=context.getContentResolver().openInputStream(uri)) {
            if(in==null){out.put("status","unavailable");return out;}
            ExifInterface exif=new ExifInterface(in);
            String raw=exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL);
            if(raw==null||raw.trim().isEmpty()) raw=exif.getAttribute(ExifInterface.TAG_DATETIME);
            if(raw==null||raw.trim().isEmpty()){out.put("status","no_date");return out;}
            SimpleDateFormat source=new SimpleDateFormat("yyyy:MM:dd HH:mm:ss",Locale.US);
            source.setLenient(false);
            Date parsed=source.parse(raw.trim());
            if(parsed==null){out.put("status","no_date");return out;}
            SimpleDateFormat day=new SimpleDateFormat("yyyy-MM-dd",Locale.US);
            out.put("status","ok");out.put("dateTaken",day.format(parsed));out.put("source","exif");return out;
        } catch(SecurityException e) {
            out.put("status","permission_changed");return out;
        } catch(Exception e) {
            android.util.Log.w("BergtourenAndroid","EXIF-Aufnahmedatum konnte nicht gelesen werden.",e);
            out.put("status","no_date");return out;
        }
    }

    static JSONObject loadImage(Context context,String value,boolean full)throws JSONException {
        JSONObject out=new JSONObject();Uri uri=parseDocument(value);
        if(uri==null||!hasDocumentPermission(context,uri)){out.put("status","permission_changed");return out;}
        Bitmap bitmap=null;
        try {
            ContentResolver resolver=context.getContentResolver();int edge=full?FULL_EDGE:THUMB_EDGE;
            if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.Q)bitmap=resolver.loadThumbnail(uri,new android.util.Size(edge,edge),null);
            else bitmap=decodeScaled(resolver,uri,edge);
            if(bitmap==null){out.put("status","unavailable");return out;}
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.JPEG,full?90:78,bytes);
            out.put("status","ok");out.put("mimeType","image/jpeg");out.put("data",Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP));return out;
        }catch(SecurityException e){out.put("status","permission_changed");return out;}
        catch(Exception e){out.put("status","unavailable");return out;}
        finally{if(bitmap!=null&&!bitmap.isRecycled())bitmap.recycle();}
    }

    static boolean release(Context context,String value) {
        Uri tree=parseTree(value);if(tree==null)return false;
        try{context.getContentResolver().releasePersistableUriPermission(tree,android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);return true;}
        catch(Exception e){return false;}
    }

    private static Bitmap decodeScaled(ContentResolver resolver,Uri uri,int edge)throws Exception{
        BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
        try(InputStream in=resolver.openInputStream(uri)){if(in==null)return null;BitmapFactory.decodeStream(in,null,bounds);}
        if(bounds.outWidth<=0||bounds.outHeight<=0)return null;int largest=Math.max(bounds.outWidth,bounds.outHeight),sample=1;
        while(largest/(sample*2)>=edge)sample*=2;
        BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=sample;options.inPreferredConfig=Bitmap.Config.RGB_565;
        try(InputStream in=resolver.openInputStream(uri)){return in==null?null:BitmapFactory.decodeStream(in,null,options);}
    }

    private static boolean hasTreePermission(Context context,Uri tree){
        for(UriPermission p:context.getContentResolver().getPersistedUriPermissions())if(p.isReadPermission()&&p.getUri().equals(tree))return true;
        return false;
    }
    private static boolean hasDocumentPermission(Context context,Uri doc){
        try{
            String id=DocumentsContract.getDocumentId(doc);
            for(UriPermission p:context.getContentResolver().getPersistedUriPermissions()){
                Uri tree=p.getUri();if(!p.isReadPermission()||!DocumentsContract.isTreeUri(tree)||!tree.getAuthority().equals(doc.getAuthority()))continue;
                String root=DocumentsContract.getTreeDocumentId(tree);
                if(id.equals(root)||id.startsWith(root.endsWith("/")?root:root+"/")||(root.endsWith(":")&&id.startsWith(root)))return true;
            }
        }catch(Exception ignored){}return false;
    }
    private static Uri parseTree(String value){
        try{if(value==null||value.length()>2048)return null;Uri u=Uri.parse(value);return "content".equalsIgnoreCase(u.getScheme())&&DocumentsContract.isTreeUri(u)?u:null;}
        catch(Exception e){return null;}
    }
    private static Uri parseDocument(String value){
        try{if(value==null||value.length()>2048)return null;Uri u=Uri.parse(value);return "content".equalsIgnoreCase(u.getScheme())&&u.getAuthority()!=null&&u.getPathSegments().contains("document")?u:null;}
        catch(Exception e){return null;}
    }
}