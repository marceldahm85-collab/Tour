package at.marcel.bergtouren;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.text.style.StyleSpan;
import android.os.Bundle;
import android.os.Build;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashSet;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class YearStatsWidgetProvider extends AppWidgetProvider {
    private static final String PREFS = "year_stats_widget";
    private static final String DEFAULT_ACCENT = "#ad7d12";
    private static final int EXPANDED_HEIGHT_DP = 160;
    private static final float COMPACT_LAYOUT_MIN_WIDTH_DP = 250f;
    private static final float COMPACT_LAYOUT_MIN_HEIGHT_DP = 64f;
    private static final String DEFAULT_WIDGET_TITLE = "BERGJAHR";
    private static final String[] METRICS = {"tours","distance","ascent","peaks","steps","time","speed","gradient","ascentRate"};
    private static final String[] DEFAULT_ORDER = {"tours","distance","ascent","peaks","steps","time","speed","gradient","ascentRate"};

    private static final int[] COMPACT_GROUPS = {R.id.widget_year_stats_compact_tours_group,R.id.widget_year_stats_compact_distance_group,R.id.widget_year_stats_compact_ascent_group};
    private static final int[] COMPACT_ICONS = {R.id.widget_year_stats_compact_tours_icon,R.id.widget_year_stats_compact_distance_icon,R.id.widget_year_stats_compact_ascent_icon};
    private static final int[] COMPACT_VALUES = {R.id.widget_year_stats_compact_tours_value,R.id.widget_year_stats_compact_distance_value,R.id.widget_year_stats_compact_ascent_value};
    private static final int[] COMPACT_DIVIDERS = {R.id.widget_year_stats_compact_divider_1,R.id.widget_year_stats_compact_divider_2};
    private static final int[] EXPANDED_GROUPS = {R.id.widget_year_stats_tours_group,R.id.widget_year_stats_distance_group,R.id.widget_year_stats_ascent_group,R.id.widget_year_stats_peaks_group,R.id.widget_year_stats_steps_group,R.id.widget_year_stats_time_group};
    private static final int[] EXPANDED_ICONS = {R.id.widget_year_stats_tours_icon,R.id.widget_year_stats_distance_icon,R.id.widget_year_stats_ascent_icon,R.id.widget_year_stats_peaks_icon,R.id.widget_year_stats_steps_icon,R.id.widget_year_stats_time_icon};
    private static final int[] EXPANDED_VALUES = {R.id.widget_year_stats_tours_value,R.id.widget_year_stats_distance_value,R.id.widget_year_stats_ascent_value,R.id.widget_year_stats_peaks_value,R.id.widget_year_stats_steps_value,R.id.widget_year_stats_time_value};
    private static final int[] EXPANDED_LABELS = {R.id.widget_year_stats_tours_label,R.id.widget_year_stats_distance_label,R.id.widget_year_stats_ascent_label,R.id.widget_year_stats_peaks_label,R.id.widget_year_stats_steps_label,R.id.widget_year_stats_time_label};
    private static final int[] EXPANDED_DIVIDERS = {R.id.widget_year_stats_expanded_divider_1,R.id.widget_year_stats_expanded_divider_2,R.id.widget_year_stats_expanded_divider_4,R.id.widget_year_stats_expanded_divider_5};

    private static final class MetricValue {
        final String value;
        final String label;
        final int icon;
        MetricValue(String value, String label, int icon) { this.value = value; this.label = label; this.icon = icon; }
    }

    public static void updateStats(Context context,int year,int tours,double distance,double ascent,long peaks,long steps,long walkingMinutes,double avgSpeed,double avgGradient,double avgAscentRate,String accent) {
        if(context==null||year<2000||year>9999||tours<0||!Double.isFinite(distance)||distance<0||!Double.isFinite(ascent)||ascent<0||peaks<0||steps<0||walkingMinutes<0||!Double.isFinite(avgSpeed)||avgSpeed<0||!Double.isFinite(avgGradient)||avgGradient<0||!Double.isFinite(avgAscentRate)||avgAscentRate<0)return;
        Context app=context.getApplicationContext();
        String safeAccent=validAccent(accent)?accent:DEFAULT_ACCENT;
        app.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putInt("year",year).putInt("tours",tours).putFloat("distance",(float)distance).putFloat("ascent",(float)ascent).putLong("peaks",peaks).putLong("steps",steps).putLong("walking_minutes",walkingMinutes).putFloat("average_speed",(float)avgSpeed).putFloat("average_gradient",(float)avgGradient).putFloat("average_ascent_rate",(float)avgAscentRate).putString("accent",safeAccent).apply();
        updateAll(app);
    }

    public static boolean updateConfiguration(Context context,String title,boolean showTours,boolean showDistance,boolean showAscent,boolean showPeaks,boolean showSteps,boolean showTime,boolean showSpeed,boolean showGradient,boolean showAscentRate,String[] metricOrder,String background) {
        if(context==null)return false;
        String safeTitle=title==null?DEFAULT_WIDGET_TITLE:title.trim();
        if(safeTitle.isEmpty())safeTitle=DEFAULT_WIDGET_TITLE;
        if(safeTitle.length()>20)safeTitle=safeTitle.substring(0,20);
        boolean[] selected={showTours,showDistance,showAscent,showPeaks,showSteps,showTime,showSpeed,showGradient,showAscentRate};
        List<String> safeOrder=normalizeOrder(metricOrder,selected);
        if(safeOrder.isEmpty()||safeOrder.size()>6)return false;
        String safeBackground="dark".equals(background)?"dark":"alpine";
        boolean persisted=context.getApplicationContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
                .putString("widget_title",safeTitle)
                .putBoolean("show_tours",showTours)
                .putBoolean("show_distance",showDistance)
                .putBoolean("show_ascent",showAscent)
                .putBoolean("show_peaks",showPeaks)
                .putBoolean("show_steps",showSteps)
                .putBoolean("show_time",showTime)
                .putBoolean("show_speed",showSpeed)
                .putBoolean("show_gradient",showGradient)
                .putBoolean("show_ascentRate",showAscentRate)
                .putString("metric_order",joinOrder(safeOrder))
                .putString("widget_background",safeBackground)
                .commit();
        if(!persisted)return false;
        updateAll(context.getApplicationContext());
        return true;
    }

    private static List<String> normalizeOrder(String[] requested,boolean[] selected) {
        List<String> out=new ArrayList<>();Set<String> seen=new HashSet<>();
        if(requested!=null)for(String id:requested)if(isSelectedMetric(id,selected)&&seen.add(id))out.add(id);
        for(String id:DEFAULT_ORDER)if(isSelectedMetric(id,selected)&&seen.add(id))out.add(id);
        if(out.size()>6)return new ArrayList<>(out.subList(0,6));
        return out;
    }
    private static boolean isSelectedMetric(String id,boolean[] selected) {
        for(int i=0;i<METRICS.length;i++)if(METRICS[i].equals(id))return selected[i];
        return false;
    }
    private static String joinOrder(List<String> order) {
        StringBuilder b=new StringBuilder();for(String id:order){if(b.length()>0)b.append(',');b.append(id);}return b.toString();
    }
    private static List<String> getStoredOrder(SharedPreferences prefs) {
        String stored=prefs.getString("metric_order","");List<String> order=new ArrayList<>();Set<String> seen=new HashSet<>();
        boolean[] selected={prefs.getBoolean("show_tours",true),prefs.getBoolean("show_distance",true),prefs.getBoolean("show_ascent",true),prefs.getBoolean("show_peaks",true),prefs.getBoolean("show_steps",true),prefs.getBoolean("show_time",true),prefs.getBoolean("show_speed",false),prefs.getBoolean("show_gradient",false),prefs.getBoolean("show_ascentRate",false)};
        if(stored!=null&&!stored.isEmpty())for(String id:stored.split(","))if(isSelectedMetric(id,selected)&&seen.add(id)&&order.size()<6)order.add(id);
        for(String id:DEFAULT_ORDER)if(isSelectedMetric(id,selected)&&seen.add(id)&&order.size()<6)order.add(id);
        if(order.isEmpty())order.add("tours");return order;
    }

    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){updateWidgets(context,manager,ids);}
    @Override public void onAppWidgetOptionsChanged(Context context,AppWidgetManager manager,int appWidgetId,Bundle newOptions){super.onAppWidgetOptionsChanged(context,manager,appWidgetId,newOptions);updateWidgets(context,manager,new int[]{appWidgetId});}
    @Override public void onReceive(Context context,Intent intent){super.onReceive(context,intent);if(intent==null)return;String action=intent.getAction();if(Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)||Intent.ACTION_DATE_CHANGED.equals(action)||"android.intent.action.TIME_SET".equals(action)||Intent.ACTION_TIMEZONE_CHANGED.equals(action))updateAll(context);}
    public static int getInstalledWidgetCount(Context context){if(context==null)return 0;int[] ids=AppWidgetManager.getInstance(context.getApplicationContext()).getAppWidgetIds(new ComponentName(context,YearStatsWidgetProvider.class));return ids==null?0:ids.length;}
    private static void updateAll(Context context){AppWidgetManager manager=AppWidgetManager.getInstance(context);int[] ids=manager.getAppWidgetIds(new ComponentName(context,YearStatsWidgetProvider.class));if(ids!=null&&ids.length>0)updateWidgets(context,manager,ids);}

    private static void updateWidgets(Context context,AppWidgetManager manager,int[] ids) {
        if(context==null||manager==null||ids==null||ids.length==0)return;

        SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        int year=Calendar.getInstance().get(Calendar.YEAR);
        boolean sameYear=prefs.getInt("year",year)==year;
        int tours=sameYear?prefs.getInt("tours",0):0;
        double distance=sameYear?prefs.getFloat("distance",0f):0d;
        double ascent=sameYear?prefs.getFloat("ascent",0f):0d;
        long peaks=sameYear?prefs.getLong("peaks",0L):0L;
        long steps=sameYear?prefs.getLong("steps",0L):0L;
        long walkingMinutes=sameYear?prefs.getLong("walking_minutes",0L):0L;
        double avgSpeed=sameYear?prefs.getFloat("average_speed",0f):0d;
        double avgGradient=sameYear?prefs.getFloat("average_gradient",0f):0d;
        double avgAscentRate=sameYear?prefs.getFloat("average_ascent_rate",0f):0d;
        int accent=parseAccent(prefs.getString("accent",DEFAULT_ACCENT));
        String widgetTitle=prefs.getString("widget_title",DEFAULT_WIDGET_TITLE);
        boolean alpineBackground=!"dark".equals(prefs.getString("widget_background","alpine"));
        List<String> order=getStoredOrder(prefs);
        NumberFormat integer=NumberFormat.getIntegerInstance(Locale.GERMANY);
        NumberFormat decimal=NumberFormat.getNumberInstance(Locale.GERMANY);
        decimal.setMinimumFractionDigits(1);
        decimal.setMaximumFractionDigits(1);
        String duration=formatDuration(walkingMinutes);

        for(int id:ids){
            if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){
                // Android 12+ wählt anhand der tatsächlichen Widget-Fläche.
                // Die Größenbereiche vermeiden die fehleranfällige Schätzung über
                // OPTION_APPWIDGET_MIN_HEIGHT (z. B. 1 Rasterzelle ≈ 102 dp).
                Map<SizeF,RemoteViews> responsiveViews=new HashMap<>();
                responsiveViews.put(
                        new SizeF(COMPACT_LAYOUT_MIN_WIDTH_DP,COMPACT_LAYOUT_MIN_HEIGHT_DP),
                        createWidgetViews(context,year,tours,distance,ascent,peaks,steps,duration,
                                avgSpeed,avgGradient,avgAscentRate,accent,widgetTitle,
                                alpineBackground,order,integer,decimal,false)
                );
                responsiveViews.put(
                        new SizeF(COMPACT_LAYOUT_MIN_WIDTH_DP,EXPANDED_HEIGHT_DP),
                        createWidgetViews(context,year,tours,distance,ascent,peaks,steps,duration,
                                avgSpeed,avgGradient,avgAscentRate,accent,widgetTitle,
                                alpineBackground,order,integer,decimal,true)
                );
                manager.updateAppWidget(id,new RemoteViews(responsiveViews));
            }else{
                Bundle options=manager.getAppWidgetOptions(id);
                int minHeight=options!=null
                        ?options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,0):0;
                boolean expanded=minHeight>=EXPANDED_HEIGHT_DP;
                manager.updateAppWidget(id,createWidgetViews(context,year,tours,distance,ascent,
                        peaks,steps,duration,avgSpeed,avgGradient,avgAscentRate,accent,
                        widgetTitle,alpineBackground,order,integer,decimal,expanded));
            }
        }
    }

    private static RemoteViews createWidgetViews(
            Context context,int year,int tours,double distance,double ascent,long peaks,long steps,
            String duration,double avgSpeed,double avgGradient,double avgAscentRate,int accent,
            String widgetTitle,boolean alpineBackground,List<String> order,
            NumberFormat integer,NumberFormat decimal,boolean expanded) {
        RemoteViews views=new RemoteViews(context.getPackageName(),R.layout.widget_year_stats);
        views.setViewVisibility(R.id.widget_year_stats_compact,expanded?View.GONE:View.VISIBLE);
        views.setViewVisibility(R.id.widget_year_stats_expanded,expanded?View.VISIBLE:View.GONE);

        String heading=widgetTitle.toUpperCase(Locale.GERMANY)+" "+year;
        views.setTextViewText(R.id.widget_year_stats_compact_heading,heading);
        views.setTextViewText(R.id.widget_year_stats_heading,heading);
        views.setTextColor(R.id.widget_year_stats_compact_heading,accent);
        views.setTextColor(R.id.widget_year_stats_heading,accent);
        views.setInt(R.id.widget_year_stats_heading_icon,"setColorFilter",accent);
        views.setInt(R.id.widget_year_stats_accent_line,"setBackgroundColor",accent);
        views.setViewVisibility(R.id.widget_year_stats_background_image,alpineBackground?View.VISIBLE:View.GONE);
        views.setViewVisibility(R.id.widget_year_stats_scrim_image,alpineBackground?View.VISIBLE:View.GONE);
        views.setInt(R.id.widget_year_stats_root,"setBackgroundColor",Color.rgb(7,12,18));

        if(expanded){
            int topCount=Math.min(3,order.size());
            int bottomCount=Math.max(0,order.size()-3);
            views.setViewVisibility(R.id.widget_year_stats_expanded_second_row,bottomCount>0?View.VISIBLE:View.GONE);
            views.setViewVisibility(R.id.widget_year_stats_expanded_row_divider,bottomCount>0?View.VISIBLE:View.GONE);
            for(int i=0;i<EXPANDED_GROUPS.length;i++){
                boolean visible=i<order.size();
                views.setViewVisibility(EXPANDED_GROUPS[i],visible?View.VISIBLE:View.GONE);
                if(visible)applyMetric(views,order.get(i),EXPANDED_ICONS[i],EXPANDED_VALUES[i],
                        EXPANDED_LABELS[i],accent,integer,decimal,distance,ascent,tours,peaks,
                        steps,duration,avgSpeed,avgGradient,avgAscentRate);
            }
            views.setViewVisibility(EXPANDED_DIVIDERS[0],topCount>1?View.VISIBLE:View.GONE);
            views.setViewVisibility(EXPANDED_DIVIDERS[1],topCount>2?View.VISIBLE:View.GONE);
            views.setViewVisibility(EXPANDED_DIVIDERS[2],bottomCount>1?View.VISIBLE:View.GONE);
            views.setViewVisibility(EXPANDED_DIVIDERS[3],bottomCount>2?View.VISIBLE:View.GONE);
        }else{
            int count=Math.min(3,order.size());
            for(int i=0;i<COMPACT_GROUPS.length;i++){
                boolean visible=i<count;
                views.setViewVisibility(COMPACT_GROUPS[i],visible?View.VISIBLE:View.GONE);
                if(visible)applyCompactMetric(views,order.get(i),COMPACT_ICONS[i],
                        COMPACT_VALUES[i],accent,integer,decimal,distance,ascent,tours,peaks,
                        steps,duration,avgSpeed,avgGradient,avgAscentRate);
            }
            views.setViewVisibility(COMPACT_DIVIDERS[0],count>1?View.VISIBLE:View.GONE);
            views.setViewVisibility(COMPACT_DIVIDERS[1],count>2?View.VISIBLE:View.GONE);
        }

        Intent open=new Intent(context,MainActivity.class);
        open.setAction(MainActivity.ACTION_OPEN_DASHBOARD);
        open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending=PendingIntent.getActivity(context,0,open,
                PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_year_stats_root,pending);
        return views;
    }

    private static void applyCompactMetric(RemoteViews views,String id,int iconId,int valueId,int accent,NumberFormat integer,NumberFormat decimal,double distance,double ascent,int tours,long peaks,long steps,String duration,double avgSpeed,double avgGradient,double avgAscentRate) {
        MetricValue m=metricValue(id,integer,decimal,distance,ascent,tours,peaks,steps,duration,avgSpeed,avgGradient,avgAscentRate);
        int split=m.value.length();
        SpannableString display=new SpannableString(m.value+"\n"+m.label);
        display.setSpan(new RelativeSizeSpan(0.62f),split+1,display.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        display.setSpan(new ForegroundColorSpan(Color.rgb(213,222,229)),split+1,display.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        display.setSpan(new StyleSpan(Typeface.BOLD),split+1,display.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        views.setTextViewText(valueId,display);
        views.setImageViewResource(iconId,m.icon);
        views.setInt(iconId,"setColorFilter",accent);
    }

    private static MetricValue metricValue(String id,NumberFormat integer,NumberFormat decimal,double distance,double ascent,int tours,long peaks,long steps,String duration,double avgSpeed,double avgGradient,double avgAscentRate) {
        switch(id){
            case "tours":return new MetricValue(integer.format(tours),"TOUREN",R.drawable.widget_ic_tours);
            case "distance":return new MetricValue(decimal.format(distance),"KM",R.drawable.widget_ic_distance);
            case "ascent":return new MetricValue(integer.format(Math.round(ascent)),"HM",R.drawable.widget_ic_ascent);
            case "peaks":return new MetricValue(integer.format(peaks),"GIPFEL",R.drawable.widget_ic_peaks);
            case "steps":return new MetricValue(integer.format(steps),"SCHRITTE",R.drawable.widget_ic_steps);
            case "time":return new MetricValue(duration,"GEHZEIT",R.drawable.widget_ic_time);
            case "speed":return new MetricValue(decimal.format(avgSpeed),"Ø KM/H",R.drawable.widget_ic_speed);
            case "gradient":return new MetricValue(integer.format(Math.round(avgGradient)),"Ø HM/KM",R.drawable.widget_ic_gradient);
            case "ascentRate":return new MetricValue(integer.format(Math.round(avgAscentRate)),"Ø HM/H",R.drawable.widget_ic_ascent_rate);
            default:return new MetricValue("0","TOUREN",R.drawable.widget_ic_tours);
        }
    }

    private static void applyMetric(RemoteViews views,String id,int iconId,int valueId,int labelId,int accent,NumberFormat integer,NumberFormat decimal,double distance,double ascent,int tours,long peaks,long steps,String duration,double avgSpeed,double avgGradient,double avgAscentRate) {
        MetricValue m=metricValue(id,integer,decimal,distance,ascent,tours,peaks,steps,duration,avgSpeed,avgGradient,avgAscentRate);
        views.setTextViewText(valueId,m.value);views.setTextViewText(labelId,m.label);views.setImageViewResource(iconId,m.icon);views.setInt(iconId,"setColorFilter",accent);
    }
    private static String formatDuration(long totalMinutes){long hours=totalMinutes/60L,minutes=totalMinutes%60L;return NumberFormat.getIntegerInstance(Locale.GERMANY).format(hours)+":"+String.format(Locale.GERMANY,"%02d",minutes);}
    private static int parseAccent(String value){if(!validAccent(value))return Color.rgb(173,125,18);try{return Color.parseColor(value);}catch(IllegalArgumentException ignored){return Color.rgb(173,125,18);}}
    private static boolean validAccent(String value){return value!=null&&value.matches("#[0-9a-fA-F]{6}");}
}
