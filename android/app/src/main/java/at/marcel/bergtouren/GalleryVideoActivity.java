package at.marcel.bergtouren;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.TextView;
import android.widget.VideoView;

/**
 * In-app player for videos referenced through the app's read-only MediaStore gallery.
 * The original file stays in its device gallery location.
 */
public final class GalleryVideoActivity extends Activity {
    static final String EXTRA_URI = "gallery_video_uri";

    private VideoView videoView;
    private TextView messageView;
    private int resumePosition;
    private boolean prepared;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().getDecorView().setSystemUiVisibility(0);

        String uriString = getIntent().getStringExtra(EXTRA_URI);
        Uri uri = Uri.parse(uriString == null ? "" : uriString);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.BLACK);

        FrameLayout playerArea = new FrameLayout(this);
        playerArea.setBackgroundColor(Color.BLACK);
        videoView = new VideoView(this);
        playerArea.addView(videoView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
        ));

        messageView = new TextView(this);
        messageView.setTextColor(Color.WHITE);
        messageView.setTextSize(14);
        messageView.setGravity(Gravity.CENTER);
        messageView.setPadding(dp(24), dp(24), dp(24), dp(24));
        messageView.setVisibility(View.GONE);
        playerArea.addView(messageView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        root.addView(playerArea, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
        ));

        // A dedicated bottom action area keeps Back reachable by thumb and
        // separate from the playback controls, including in landscape.
        LinearLayout footer = new LinearLayout(this);
        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        footer.setPadding(dp(16), dp(8), dp(16), dp(8));
        footer.setBackgroundColor(Color.rgb(13, 18, 24));

        Button back = new Button(this);
        back.setText("←  Zurück");
        back.setTextSize(14);
        back.setAllCaps(false);
        back.setTextColor(Color.WHITE);
        back.setContentDescription("Zurück zur Tour");
        back.setMinWidth(dp(124));
        back.setMinHeight(dp(48));
        back.setPadding(dp(16), 0, dp(18), 0);
        GradientDrawable backBackground = new GradientDrawable();
        backBackground.setColor(Color.rgb(28, 37, 47));
        backBackground.setCornerRadius(dp(24));
        backBackground.setStroke(dp(1), Color.rgb(86, 108, 130));
        back.setBackground(backBackground);
        back.setOnClickListener(view -> finish());
        footer.addView(back, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, dp(48)
        ));

        root.addView(footer, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(64)
        ));
        setContentView(root);

        if (!GalleryMediaStore.isAllowedVideoUri(uri)
                || !GalleryMediaStore.hasVideoAccess(this)) {
            showError("Dieses Video ist nicht verfügbar. Bitte prüfe den Galerie-Zugriff.");
            return;
        }

        MediaController controller = new MediaController(this);
        controller.setAnchorView(videoView);
        videoView.setMediaController(controller);

        videoView.setOnPreparedListener(player -> {
            prepared = true;
            if (resumePosition > 0) videoView.seekTo(resumePosition);
            videoView.start();
        });
        videoView.setOnErrorListener((player, what, extra) -> {
            showError("Das Video konnte nicht wiedergegeben werden.");
            return true;
        });
        videoView.setOnCompletionListener(player -> {
            // Die native Mediensteuerung bleibt sichtbar und ermöglicht erneutes Abspielen.
            if (videoView != null) videoView.seekTo(0);
        });

        if (savedInstanceState != null) {
            resumePosition = savedInstanceState.getInt("video_position", 0);
        }

        try {
            videoView.setVideoURI(uri);
        } catch (RuntimeException error) {
            showError("Das Video konnte nicht geöffnet werden.");
        }
    }

    private void showError(String message) {
        if (messageView != null) {
            messageView.setText(message);
            messageView.setVisibility(View.VISIBLE);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (videoView != null && prepared) {
            outState.putInt("video_position", videoView.getCurrentPosition());
        }
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        if (videoView != null && prepared && videoView.isPlaying()) {
            resumePosition = videoView.getCurrentPosition();
            videoView.pause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (videoView != null && prepared && resumePosition > 0) {
            videoView.seekTo(resumePosition);
            videoView.start();
            resumePosition = 0;
        }
    }

    @Override
    protected void onDestroy() {
        if (videoView != null) {
            videoView.stopPlayback();
            videoView = null;
        }
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
