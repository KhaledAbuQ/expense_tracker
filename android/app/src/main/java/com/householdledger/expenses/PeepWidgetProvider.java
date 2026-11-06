package com.householdledger.expenses;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Log;
import android.widget.RemoteViews;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class PeepWidgetProvider extends AppWidgetProvider {
    private static final int FRAME_SIZE = 32;
    private static final String TAG = "PeepWidget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_peep);

        Intent intent = new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_MAIN)
                .putExtra(PocketExpensesWidgetProvider.EXTRA_ACTION, "home")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        views.setOnClickPendingIntent(R.id.peep_widget_root,
                PendingIntent.getActivity(context, 651, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        populateFrames(context, views);
        manager.updateAppWidget(ids, views);
    }

    static void populateFrames(Context context, RemoteViews views) {
        try {
            JSONObject manifest = readManifest(context);
            String name = dailyCharacter(context, manifest);
            views.removeAllViews(R.id.peep_frames);
            addFrames(context, views, name, manifest.getJSONObject(name));
            views.setContentDescription(R.id.peep_frames, "Daily Peep: " + name);
        } catch (IOException | JSONException error) {
            Log.e(TAG, "Could not load Peep frames", error);
        }
    }

    private static JSONObject readManifest(Context context) throws IOException, JSONException {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                context.getAssets().open("peep/idle.json"), StandardCharsets.UTF_8))) {
            return new JSONObject(reader.readLine());
        }
    }

    private static String dailyCharacter(Context context, JSONObject manifest) {
        SharedPreferences preferences = context.getSharedPreferences("peep_widget", Context.MODE_PRIVATE);
        String day = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String previous = preferences.getString("character", "");
        if (day.equals(preferences.getString("day", "")) && manifest.has(previous)) return previous;

        ArrayList<String> choices = new ArrayList<>();
        manifest.keys().forEachRemaining(name -> {
            if (!name.equals(previous)) choices.add(name);
        });
        String name = choices.get(new Random().nextInt(choices.size()));
        preferences.edit().putString("day", day).putString("character", name).apply();
        return name;
    }

    private static void addFrames(Context context, RemoteViews views, String name, JSONObject animation)
            throws IOException, JSONException {
        try (InputStream stream = context.getAssets().open("peep/" + name + ".png")) {
            Bitmap sheet = BitmapFactory.decodeStream(stream);
            if (sheet == null) throw new IOException("Invalid Peep sprite sheet");

            int columns = animation.getInt("columns");
            JSONArray frames = animation.getJSONArray("frames");
            Map<Integer, Bitmap> tiles = new HashMap<>();
            for (int i = 0; i < frames.length(); i++) {
                int tile = frames.getInt(i);
                Bitmap frame = tiles.get(tile);
                if (frame == null) {
                    frame = Bitmap.createBitmap(sheet,
                            tile % columns * FRAME_SIZE, tile / columns * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE);
                    tiles.put(tile, frame);
                }
                RemoteViews image = new RemoteViews(context.getPackageName(), R.layout.widget_peep_frame);
                image.setImageViewBitmap(R.id.peep_frame, frame);
                views.addView(R.id.peep_frames, image);
            }
        }
    }
}
