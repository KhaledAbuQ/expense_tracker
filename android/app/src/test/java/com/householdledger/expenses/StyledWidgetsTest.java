package com.householdledger.expenses;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.*;
import android.view.View;
import android.widget.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import java.io.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=34, qualifiers="w400dp-h800dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class StyledWidgetsTest {
    @Test public void weeklyLauncherKeepsExactlyOneIconEnabled() {
        Context context=RuntimeEnvironment.getApplication();
        WeeklyIconReceiver.sync(context);
        android.content.pm.PackageManager manager=context.getPackageManager();
        boolean alternate=IconWeek.index(java.util.Calendar.getInstance())==1;
        android.content.ComponentName selected=new android.content.ComponentName(context,context.getPackageName()+(alternate?".LauncherCelebration":".LauncherClassic"));
        android.content.ComponentName other=new android.content.ComponentName(context,context.getPackageName()+(alternate?".LauncherClassic":".LauncherCelebration"));
        int chosen=manager.getComponentEnabledSetting(selected),disabled=manager.getComponentEnabledSetting(other);
        assertTrue(chosen==android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED || (!alternate && chosen==android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DEFAULT));
        assertTrue(disabled==android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED || (!alternate && disabled==android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DEFAULT));
        WeeklyIconReceiver.sync(context);
        assertEquals(chosen,manager.getComponentEnabledSetting(selected));
    }
    @Test public void renderAndApplyAcrossLauncherSizes() throws Exception {
        Context context=RuntimeEnvironment.getApplication();
        SharedPreferences prefs=context.getSharedPreferences("widget_test",0);
        prefs.edit().putString("month_label","Spent in November").putString("month_total","JOD 247.600").putString("today_total","JOD 0.000").putString("dining_total","JOD 150.000").putString("grocery_total","JOD 37.650").putString("first_category_icon","zap").putString("second_category_icon","car").apply();
        JSONObject data=new JSONObject().put("monthAmount",247.6).put("todayAmount",0).put("basis","retail").put("price",91.2).put("updatedAt","Nov 9, 12:26 AM");
        JSONArray history=new JSONArray();
        for(int i=0;i<12;i++)history.put(new JSONObject().put("timestamp",1793224800000L+i*86400000L).put("price",89.4+i*.16+Math.sin(i)*.3));
        data.put("history",history);
        int[][] sizes={{48,48},{72,200},{160,100},{180,260},{220,220},{320,420},{420,280},{600,500},{1000,160}};
        File folder=new File("build/outputs/widget-previews");assertTrue(folder.mkdirs()||folder.exists());
        for(String kind:new String[]{"pocket","gold"})for(int[] size:sizes){
            int w=size[0],h=size[1];
            RemoteViews remote=FinanceWidgetProvider.views(context,kind,data,prefs,w,h,2_000_000);
            View root=remote.apply(context,new FrameLayout(context));
            root.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));root.layout(0,0,w,h);
            assertEquals(w,root.getMeasuredWidth());assertEquals(h,root.getMeasuredHeight());
            ViewFlipper pot=root.findViewById(R.id.gold_pot_frames);
            if(kind.equals("gold")&&StyledWidgetRenderer.showsPot(w,h))assertTrue(pot.getChildCount()>1);
            Bitmap preview=Bitmap.createBitmap(w*2,h*2,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(preview);canvas.scale(2,2);root.draw(canvas);
            try(FileOutputStream out=new FileOutputStream(new File(folder,kind+"-"+w+"x"+h+".png"))){assertTrue(preview.compress(Bitmap.CompressFormat.PNG,100,out));}
            assertNotEquals(0,Color.alpha(preview.getPixel(w,h)));
        }
        int[] first=new int[128*128],second=new int[128*128];GoldPotAnimation.frame(128,0).getPixels(first,0,128,0,0,128,128);GoldPotAnimation.frame(128,.25f).getPixels(second,0,128,0,0,128,128);
        assertFalse(java.util.Arrays.equals(first,second));
    }
}
