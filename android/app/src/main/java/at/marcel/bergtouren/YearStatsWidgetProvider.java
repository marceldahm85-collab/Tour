package at.marcel.bergtouren;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;

/** Native home-screen widget. The tour database remains in WebView storage. */
public final class YearStatsWidgetProvider extends AppWidgetProvider {
    private static final String PREFS = "year_stats_widget";
    private static final String DEFAULT_ACCENT = "#ad7d12";
    private static final int EXPANDED_HEIGHT_DP = 100;
    private static final String DEFAULT_WIDGET_TITLE = "BERGJAHR";

    public static void updateStats(Context context, int year, int tours,
                                   double distance, double ascent, long peaks,
                                   long steps, long walkingMinutes, String accent) {
        if (context == null || year < 2000 || year > 9999 || tours < 0
                || !Double.isFinite(distance) || distance < 0
                || !Double.isFinite(ascent) || ascent < 0
                || peaks < 0 || steps < 0 || walkingMinutes < 0) return;

        Context app = context.getApplicationContext();
        String safeAccent = validAccent(accent) ? accent : DEFAULT_ACCENT;
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putInt("year", year)
                .putInt("tours", tours)
                .putFloat("distance", (float) distance)
                .putFloat("ascent", (float) ascent)
                .putLong("peaks", peaks)
                .putLong("steps", steps)
                .putLong("walking_minutes", walkingMinutes)
                .putString("accent", safeAccent)
                .apply();
        updateAll(app);
    }

    public static void updateConfiguration(Context context, String title,
            boolean showTours, boolean showDistance, boolean showAscent,
            boolean showPeaks, boolean showSteps, boolean showTime, String background) {
        if (context == null) return;
        String safeTitle = title == null ? DEFAULT_WIDGET_TITLE : title.trim();
        if (safeTitle.isEmpty()) safeTitle = DEFAULT_WIDGET_TITLE;
        if (safeTitle.length() > 20) safeTitle = safeTitle.substring(0, 20);
        if (!showTours && !showDistance && !showAscent && !showPeaks && !showSteps && !showTime) {
            showTours = true;
        }
        String safeBackground = "dark".equals(background) ? "dark" : "alpine";
        context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("widget_title", safeTitle)
                .putBoolean("show_tours", showTours)
                .putBoolean("show_distance", showDistance)
                .putBoolean("show_ascent", showAscent)
                .putBoolean("show_peaks", showPeaks)
                .putBoolean("show_steps", showSteps)
                .putBoolean("show_time", showTime)
                .putString("widget_background", safeBackground)
                .apply();
        updateAll(context.getApplicationContext());
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        updateWidgets(context, manager, ids);
    }

    @Override public void onAppWidgetOptionsChanged(Context context,
            AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, manager, appWidgetId, newOptions);
        updateWidgets(context, manager, new int[] { appWidgetId });
    }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(action)
                || "android.intent.action.TIME_SET".equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) updateAll(context);
    }

    private static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(
                new ComponentName(context, YearStatsWidgetProvider.class));
        if (ids != null && ids.length > 0) updateWidgets(context, manager, ids);
    }

    private static void updateWidgets(Context context, AppWidgetManager manager, int[] ids) {
        if (context == null || manager == null || ids == null || ids.length == 0) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int year = Calendar.getInstance().get(Calendar.YEAR);
        boolean sameYear = prefs.getInt("year", year) == year;
        int tours = sameYear ? prefs.getInt("tours", 0) : 0;
        double distance = sameYear ? prefs.getFloat("distance", 0f) : 0d;
        double ascent = sameYear ? prefs.getFloat("ascent", 0f) : 0d;
        long peaks = sameYear ? prefs.getLong("peaks", 0L) : 0L;
        long steps = sameYear ? prefs.getLong("steps", 0L) : 0L;
        long walkingMinutes = sameYear ? prefs.getLong("walking_minutes", 0L) : 0L;
        int accent = parseAccent(prefs.getString("accent", DEFAULT_ACCENT));
        String widgetTitle = prefs.getString("widget_title", DEFAULT_WIDGET_TITLE);
        boolean showTours = prefs.getBoolean("show_tours", true);
        boolean showDistance = prefs.getBoolean("show_distance", true);
        boolean showAscent = prefs.getBoolean("show_ascent", true);
        boolean showPeaks = prefs.getBoolean("show_peaks", true);
        boolean showSteps = prefs.getBoolean("show_steps", true);
        boolean showTime = prefs.getBoolean("show_time", true);
        boolean alpineBackground = !"dark".equals(prefs.getString("widget_background", "alpine"));

        NumberFormat integer = NumberFormat.getIntegerInstance(Locale.GERMANY);
        NumberFormat km = NumberFormat.getNumberInstance(Locale.GERMANY);
        km.setMinimumFractionDigits(1);
        km.setMaximumFractionDigits(1);

        String toursText = integer.format(tours);
        String distanceText = km.format(distance);
        String ascentText = integer.format(Math.round(ascent));
        String peaksText = integer.format(peaks);
        String stepsText = integer.format(steps);
        String walkingTimeText = formatDuration(walkingMinutes);

        for (int id : ids) {
            Bundle options = manager.getAppWidgetOptions(id);
            int minHeight = options != null
                    ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
                    : 0;
            boolean expanded = minHeight >= EXPANDED_HEIGHT_DP;

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_year_stats);
            views.setViewVisibility(R.id.widget_year_stats_compact,
                    expanded ? View.GONE : View.VISIBLE);
            views.setViewVisibility(R.id.widget_year_stats_expanded,
                    expanded ? View.VISIBLE : View.GONE);

            views.setTextViewText(R.id.widget_year_stats_compact_heading, widgetTitle.toUpperCase(Locale.GERMANY) + " " + year);
            views.setTextViewText(R.id.widget_year_stats_compact_tours_value, toursText);
            views.setTextViewText(R.id.widget_year_stats_compact_distance_value, distanceText);
            views.setTextViewText(R.id.widget_year_stats_compact_ascent_value, ascentText);

            views.setTextViewText(R.id.widget_year_stats_heading, widgetTitle.toUpperCase(Locale.GERMANY) + " " + year);
            views.setTextViewText(R.id.widget_year_stats_tours_value, toursText);
            views.setTextViewText(R.id.widget_year_stats_distance_value, distanceText);
            views.setTextViewText(R.id.widget_year_stats_ascent_value, ascentText);
            views.setTextViewText(R.id.widget_year_stats_peaks_value, peaksText);
            views.setTextViewText(R.id.widget_year_stats_steps_value, stepsText);
            views.setTextViewText(R.id.widget_year_stats_time_value, walkingTimeText);

            views.setInt(R.id.widget_year_stats_accent_line, "setBackgroundColor", accent);
            views.setViewVisibility(R.id.widget_year_stats_background_image,
                    alpineBackground ? View.VISIBLE : View.GONE);
            views.setViewVisibility(R.id.widget_year_stats_scrim_image,
                    alpineBackground ? View.VISIBLE : View.GONE);
            views.setInt(R.id.widget_year_stats_root, "setBackgroundColor", Color.rgb(7, 12, 18));
            setMetricVisibility(views, showTours,
                    R.id.widget_year_stats_compact_tours_group, R.id.widget_year_stats_tours_group);
            setMetricVisibility(views, showDistance,
                    R.id.widget_year_stats_compact_distance_group, R.id.widget_year_stats_distance_group);
            setMetricVisibility(views, showAscent,
                    R.id.widget_year_stats_compact_ascent_group, R.id.widget_year_stats_ascent_group);
            setMetricVisibility(views, showPeaks, R.id.widget_year_stats_peaks_group);
            setMetricVisibility(views, showSteps, R.id.widget_year_stats_steps_group);
            setMetricVisibility(views, showTime, R.id.widget_year_stats_time_group);
            views.setInt(R.id.widget_year_stats_compact_tours_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_compact_distance_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_compact_ascent_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_heading_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_tours_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_distance_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_ascent_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_peaks_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_steps_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_time_icon, "setColorFilter", accent);

            Intent open = new Intent(context, MainActivity.class);
            open.setAction(MainActivity.ACTION_OPEN_DASHBOARD);
            open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pending = PendingIntent.getActivity(context, 0, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_year_stats_root, pending);
            manager.updateAppWidget(id, views);
        }
    }

    private static void setMetricVisibility(RemoteViews views, boolean visible, int... ids) {
        for (int id : ids) {
            views.setViewVisibility(id, visible ? View.VISIBLE : View.GONE);
        }
    }

    private static String formatDuration(long totalMinutes) {
        long hours = totalMinutes / 60L;
        long minutes = totalMinutes % 60L;
        return NumberFormat.getIntegerInstance(Locale.GERMANY).format(hours)
                + ":" + String.format(Locale.GERMANY, "%02d", minutes);
    }

    private static int parseAccent(String value) {
        if (!validAccent(value)) return Color.rgb(173, 125, 18);
        try { return Color.parseColor(value); }
        catch (IllegalArgumentException ignored) { return Color.rgb(173, 125, 18); }
    }

    private static boolean validAccent(String value) {
        return value != null && value.matches("#[0-9a-fA-F]{6}");
    }
}
