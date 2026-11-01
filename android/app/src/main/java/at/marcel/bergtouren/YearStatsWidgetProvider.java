package at.marcel.bergtouren;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;
import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;

/** Native home-screen widget. The tour database remains in WebView storage. */
public final class YearStatsWidgetProvider extends AppWidgetProvider {
    private static final String PREFS = "year_stats_widget";
    private static final String DEFAULT_ACCENT = "#ad7d12";

    public static void updateStats(Context context, int year, int tours,
                                   double distance, double ascent, String accent) {
        if (context == null || year < 2000 || year > 9999 || tours < 0
                || !Double.isFinite(distance) || distance < 0
                || !Double.isFinite(ascent) || ascent < 0) return;
        Context app = context.getApplicationContext();
        String safeAccent = validAccent(accent) ? accent : DEFAULT_ACCENT;
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putInt("year", year).putInt("tours", tours)
                .putFloat("distance", (float) distance)
                .putFloat("ascent", (float) ascent)
                .putString("accent", safeAccent).apply();
        updateAll(app);
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        updateWidgets(context, ids);
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
        if (ids != null && ids.length > 0) updateWidgets(context, ids);
    }

    private static void updateWidgets(Context context, int[] ids) {
        if (context == null || ids == null || ids.length == 0) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int year = Calendar.getInstance().get(Calendar.YEAR);
        boolean sameYear = prefs.getInt("year", year) == year;
        int tours = sameYear ? prefs.getInt("tours", 0) : 0;
        double distance = sameYear ? prefs.getFloat("distance", 0f) : 0d;
        double ascent = sameYear ? prefs.getFloat("ascent", 0f) : 0d;
        int accent = parseAccent(prefs.getString("accent", DEFAULT_ACCENT));

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_year_stats);
            views.setTextViewText(R.id.widget_year_stats_heading, "BERGJAHR " + year);
            views.setTextViewText(R.id.widget_year_stats_tours_value,
                    NumberFormat.getIntegerInstance(Locale.GERMANY).format(tours));
            NumberFormat km = NumberFormat.getNumberInstance(Locale.GERMANY);
            km.setMinimumFractionDigits(1);
            km.setMaximumFractionDigits(1);
            views.setTextViewText(R.id.widget_year_stats_distance_value, km.format(distance));
            views.setTextViewText(R.id.widget_year_stats_ascent_value,
                    NumberFormat.getIntegerInstance(Locale.GERMANY).format(Math.round(ascent)));

            views.setInt(R.id.widget_year_stats_accent_line, "setBackgroundColor", accent);
            views.setInt(R.id.widget_year_stats_heading_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_tours_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_distance_icon, "setColorFilter", accent);
            views.setInt(R.id.widget_year_stats_ascent_icon, "setColorFilter", accent);

            Intent open = new Intent(context, MainActivity.class);
            open.setAction(MainActivity.ACTION_OPEN_YEAR_STATS);
            open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pending = PendingIntent.getActivity(context, 0, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_year_stats_root, pending);
            AppWidgetManager.getInstance(context).updateAppWidget(id, views);
        }
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
