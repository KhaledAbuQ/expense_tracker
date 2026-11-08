package com.householdledger.expenses;

import android.content.Context;
import android.graphics.*;
import android.provider.Settings;
import android.os.Build;
import android.widget.RemoteViews;

/** Small host-side frame loop; no alarms, background service, or repeated widget updates. */
final class GoldPotAnimation {
    private static Bitmap[] frames;
    private static int resolution;

    static synchronized void populate(Context context, RemoteViews views) {
        boolean motion = Settings.Global.getFloat(context.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0;
        android.util.DisplayMetrics metrics = context.getResources().getDisplayMetrics();
        int copies = Build.VERSION.SDK_INT >= 31 ? 1 : 2;
        int budgetSize = (int)Math.sqrt(metrics.widthPixels * (double)metrics.heightPixels * .75 / (16 * copies));
        int size = Math.max(48, Math.min(256, Math.min(budgetSize, Math.round(128 * metrics.density))) / 8 * 8);
        if (frames == null || resolution != size) {
            resolution = size;
            frames = new Bitmap[16];
            for (int i = 0; i < frames.length; i++) {
                Bitmap generated = frame(size, i / 16f);
                frames[i] = Build.VERSION.SDK_INT >= 31 ? generated.asShared() : generated.copy(Bitmap.Config.ARGB_8888, false);
                if (frames[i] != generated) generated.recycle();
            }
        }
        views.removeAllViews(R.id.gold_pot_frames);
        for (int i = 0; i < (motion ? frames.length : 1); i++) {
            RemoteViews child = new RemoteViews(context.getPackageName(), R.layout.widget_gold_pot_frame);
            child.setImageViewBitmap(R.id.gold_pot_frame, frames[i]);
            views.addView(R.id.gold_pot_frames, child);
        }
        views.setContentDescription(R.id.gold_pot_frames, "Pot of gold");
    }

    static Bitmap frame(int size, float phase) {
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bitmap); c.scale(size / 160f, size / 160f);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setShader(new RadialGradient(80, 146, 52, 0x558e571e, Color.TRANSPARENT, Shader.TileMode.CLAMP));
        c.save(); c.scale(1, .18f, 80, 146); c.drawCircle(80, 146, 52, p); c.restore();
        float wave = (float) Math.sin(phase * Math.PI * 2);
        c.save(); c.translate(0, -2 - 3 * wave); c.rotate(wave * 2, 80, 120);
        p.setShader(null); p.setColor(0xff007e43);
        c.save(); c.rotate(25, 46, 132); c.drawRoundRect(39, 123, 50, 145, 5, 5, p); c.restore();
        c.save(); c.rotate(-25, 114, 132); c.drawRoundRect(110, 123, 121, 145, 5, 5, p); c.restore();
        float[][] coins = {{52,53,34},{77,53,35},{43,45,37},{70,45,36},{92,45,27},{50,37,35},{80,37,34},{63,29,39},{70,21,29}};
        c.save(); c.translate(0, -wave * 1.5f);
        for (float[] coin : coins) {
            p.setShader(new LinearGradient(0, coin[1], 0, coin[1] + 9, 0xffffe43b, 0xfff3a000, Shader.TileMode.CLAMP));
            c.drawRoundRect(coin[0], coin[1], coin[0] + coin[2], coin[1] + 9, 4.5f, 4.5f, p);
            p.setShader(null); p.setColor(0xaafff18a); p.setStrokeWidth(1.5f);
            for (int j = 7; j < coin[2] - 4; j += 7) c.drawLine(coin[0] + j, coin[1] + 2, coin[0] + j, coin[1] + 6, p);
        }
        c.restore();
        p.setShader(new LinearGradient(0,87,0,111,0xffffdf35,0xfff5a000,Shader.TileMode.CLAMP));
        c.drawRoundRect(20,87,30,111,5,5,p); c.drawRoundRect(130,87,140,111,5,5,p);
        Path body = new Path(); body.moveTo(33,72); body.cubicTo(21,91,37,143,80,143); body.cubicTo(123,143,139,91,127,72); body.close();
        p.setShader(new LinearGradient(35,75,125,135,new int[]{0xff05ce70,0xff009f4f,0xff005e39},new float[]{0,.55f,1},Shader.TileMode.CLAMP));
        c.drawPath(body,p); p.setShader(null); p.setColor(0x302be586); c.drawOval(38,77,86,115,p);
        p.setColor(0xff007d42); c.drawRoundRect(24,64,136,81,8.5f,8.5f,p);
        p.setColor(0xff13db72); c.drawRoundRect(31,65,116,71,3,3,p);
        for (int i=0;i<4;i++) {
            c.save();c.rotate(i*90,80,108);
            Path leaf=new Path();leaf.moveTo(80,108);leaf.cubicTo(58,100,63,83,72,87);leaf.quadTo(78,88,80,95);leaf.quadTo(84,84,91,88);leaf.cubicTo(102,94,91,104,80,108);leaf.close();
            p.setColor(0xff20dc75);p.setStyle(Paint.Style.FILL);c.drawPath(leaf,p);p.setColor(0xff008f49);p.setStrokeWidth(2);p.setStyle(Paint.Style.STROKE);c.drawPath(leaf,p);p.setStyle(Paint.Style.FILL);c.restore();
        }
        p.setColor(0xff007e43);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(3);Path stem=new Path();stem.moveTo(80,111);stem.quadTo(81,122,89,127);c.drawPath(stem,p);p.setStyle(Paint.Style.FILL);c.restore();
        float glow = .65f + .35f * (float)Math.sin(phase * Math.PI * 2 + 1);
        star(c,p,22,37,12,glow);star(c,p,129,23,10,1-glow*.4f);star(c,p,146,55,7,glow);
        return bitmap;
    }
    private static void star(Canvas c,Paint p,float x,float y,float size,float alpha){
        p.setShader(null);p.setColor(0xffffc20a);p.setAlpha(Math.round(alpha*255));Path shape=new Path();shape.moveTo(x,y-size);shape.lineTo(x+size*.3f,y-size*.3f);shape.lineTo(x+size,y);shape.lineTo(x+size*.3f,y+size*.3f);shape.lineTo(x,y+size);shape.lineTo(x-size*.3f,y+size*.3f);shape.lineTo(x-size,y);shape.lineTo(x-size*.3f,y-size*.3f);shape.close();c.drawPath(shape,p);p.setAlpha(255);
    }
}
