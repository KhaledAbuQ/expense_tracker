package com.householdledger.expenses;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.*;
import android.graphics.drawable.Drawable;
import android.text.TextUtils;
import android.text.TextPaint;
import org.json.*;
import java.text.SimpleDateFormat;
import java.util.*;

/** Responsive, data-driven glass cards. All coordinates are logical launcher dp. */
final class StyledWidgetRenderer {
    private static final int INK=0xff202027, MUTED=0xff77737e, BROWN=0xff8c6544;
    private final Canvas c; private final TextPaint p=new TextPaint(Paint.ANTI_ALIAS_FLAG);
    private final float w,h,pad;
    private StyledWidgetRenderer(Canvas canvas,int width,int height){c=canvas;w=width;h=height;pad=Math.max(5,Math.min(22,Math.min(w,h)*.065f));}
    static boolean showsPeep(int w,int h){return w>=200 && h>=260;}
    static boolean showsPot(int w,int h){return w>=260 && h>=220;}
    static Bitmap render(Context context,String kind,JSONObject data,SharedPreferences prefs,int width,int height,int pixelBudget){
        float scale=Math.min(2f,(float)Math.sqrt((double)pixelBudget/(width*height)));
        Bitmap image=Bitmap.createBitmap(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)),Bitmap.Config.ARGB_8888);
        Canvas canvas=new Canvas(image);canvas.scale(scale,scale);
        StyledWidgetRenderer art=new StyledWidgetRenderer(canvas,width,height);
        art.surface(kind.equals("gold"));
        if(kind.equals("gold"))art.gold(data);else art.spending(context,data,prefs);
        return image;
    }
    private void fill(int color){p.setShader(null);p.setStyle(Paint.Style.FILL);p.setColor(color);}
    private void rounded(float x,float y,float width,float height,float radius,int color){fill(color);c.drawRoundRect(x,y,x+Math.max(0,width),y+Math.max(0,height),radius,radius,p);}
    private void gradient(float x,float y,float width,float height,float radius,int from,int to){fill(from);p.setShader(new LinearGradient(x,y,x+width,y+height,from,to,Shader.TileMode.CLAMP));c.drawRoundRect(x,y,x+width,y+height,radius,radius,p);p.setShader(null);}
    private void text(String value,float x,float baseline,float size,float width,int color,boolean bold){
        fill(color);p.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));p.setTextSize(size);
        while(p.measureText(value)>width && size>7){size-=.5f;p.setTextSize(size);}
        c.drawText(TextUtils.ellipsize(value,p,Math.max(1,width),TextUtils.TruncateAt.END).toString(),x,baseline,p);
    }
    private void border(float x,float y,float width,float height,float radius,int color,float stroke){fill(color);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(stroke);c.drawRoundRect(x,y,x+width,y+height,radius,radius,p);p.setStyle(Paint.Style.FILL);}
    private void surface(boolean gold){
        float radius=Math.min(30,Math.min(w,h)*.17f);
        gradient(1,1,w-2,h-2,radius,gold?0xfffff0dd:0xfffffbfa,gold?0xffffe6cf:0xfff5f0ff);
        c.save();Path clip=new Path();clip.addRoundRect(new RectF(1,1,w-1,h-1),radius,radius,Path.Direction.CW);c.clipPath(clip);
        Path wave=new Path();wave.moveTo(-w*.2f,h*.67f);wave.cubicTo(w*.5f,h*1.02f,w*.63f,h*.40f,w*1.2f,h*.52f);wave.lineTo(w,h);wave.lineTo(0,h);wave.close();fill(gold?0x33ffc58e:0x20ffc4a8);c.drawPath(wave,p);
        Path shine=new Path();shine.moveTo(-w*.1f,0);shine.lineTo(w*.76f,0);shine.cubicTo(w*.4f,h*.23f,w*.1f,h*.19f,-w*.1f,h*.14f);shine.close();fill(0x65ffffff);c.drawPath(shine,p);c.restore();
        border(1,1,w-2,h-2,radius,0xeaffffff,1.5f);border(2.5f,2.5f,w-5,h-5,Math.max(2,radius-1),gold?0x30ddb07f:0x30d6c1e8,.7f);
    }
    private static String amount(double value){return String.format(Locale.US,"%,.3f",value);}
    private String shortMoney(double value){return Math.abs(value)>=1000000?String.format(Locale.US,"%.1fM",value/1000000):Math.abs(value)>=1000?String.format(Locale.US,"%.1fk",value/1000):String.format(Locale.US,"%.1f",value);}
    private void spending(Context context,JSONObject data,SharedPreferences prefs){
        boolean tiny=w<120 || h<140;
        String total=prefs.getString("month_total","JOD "+amount(data.optDouble("monthAmount",0)));
        float footerHeight=h<90?18:40,footerTop=h-pad-footerHeight;
        if(tiny){
            text(w<85?"JOD":prefs.getString("month_label","Spent this month"),pad,pad+(h<65?6:9),h<65?7:9,w-pad*2,MUTED,false);
            double numeric=data.optDouble("monthAmount",0);
            try { numeric=Double.parseDouble(total.replaceAll("[^0-9.\\-]", "")); } catch(NumberFormatException ignored) {}
            text(w<105?shortMoney(numeric):total,pad,Math.min(footerTop-3,pad+32),h<65?10:Math.min(23,w*.23f),w-pad*2,INK,true);
        }else{
            rounded(pad,pad+2,3,19,2,0xffffba87);
            text(prefs.getString("month_label","Spent this month"),pad+10,pad+13,Math.min(14,w*.045f),w-pad*2-10,MUTED,false);
            float baseline=pad+57;
            text(total,pad,baseline,Math.min(43,w*.126f),w-pad*2,INK,true);
            boolean today=h>=260;
            float limit=today?footerTop-72:footerTop-12;
            float chipTop=baseline+28;
            if(chipTop+36<=limit){
                if(w>=220){float cw=(w-pad*2-9)/2;chip(context,prefs,pad,chipTop,cw,true);chip(context,prefs,pad+cw+9,chipTop,cw,false);}
                else {chip(context,prefs,pad,chipTop,w-pad*2,true);if(chipTop+76<=limit)chip(context,prefs,pad,chipTop+40,w-pad*2,false);}
            }
            if(today){
                float available=w-pad*2-(showsPeep((int)w,(int)h)?86:0);
                text("Today",pad,footerTop-44,14,available,MUTED,false);
                text(prefs.getString("today_total","JOD "+amount(data.optDouble("todayAmount",0))),pad,footerTop-16,Math.min(30,w*.10f),available,INK,true);
                if(showsPeep((int)w,(int)h)){fill(0x36d8c6ff);c.drawOval(w-pad-89,footerTop-103,w-pad+1,footerTop-15,p);fill(0x20ffd5b4);c.drawOval(w-pad-69,footerTop-100,w-pad+6,footerTop-38,p);}
            }
        }
        gradient(pad,footerTop,w-pad*2,footerHeight,footerHeight/2,0xff41414f,0xff212127);
        border(pad+1,footerTop+1,w-pad*2-2,footerHeight-2,footerHeight/2,0x608b879f,.7f);
        float font=h<90?9:Math.min(17,w*.057f);
        String label=w<100?"+ Add":"+ Add expense";
        p.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));p.setTextSize(font);float length=p.measureText(label);
        text(label,Math.max(pad+3,(w-length)/2),footerTop+footerHeight/2+font*.34f,font,w-pad*2-6,Color.WHITE,true);
    }
    private void chip(Context context,SharedPreferences prefs,float x,float y,float width,boolean first){
        gradient(x,y,width,36,14,first?0xfff3eaff:0xffffeddf,first?0xffe9d9f7:0xffffd9c4);
        border(x+.6f,y+.6f,width-1.2f,34.8f,14,0xf0ffffff,1);
        border(x,y,width,36,14,first?0x40cfa4e9:0x40f5a66c,.6f);
        Drawable icon=context.getDrawable(PocketExpensesWidgetProvider.categoryIcon(prefs.getString(first?"first_category_icon":"second_category_icon","")));
        if(icon!=null){icon=icon.mutate();icon.setTint(first?0xff8853ab:0xff6f4937);icon.setBounds(Math.round(x+9),Math.round(y+10),Math.round(x+25),Math.round(y+26));icon.draw(c);}
        text(prefs.getString(first?"dining_total":"grocery_total","JOD 0.000"),x+32,y+24,14,width-38,INK,false);
    }
    private void gold(JSONObject data){
        boolean valid="retail".equals(data.optString("basis")) && Double.isFinite(data.optDouble("price")) && data.optDouble("price")>0;
        boolean tiny=w<140 || h<100;
        String value=valid?String.format(Locale.US,"JOD %.2f/g",data.optDouble("price")):"Price unavailable";
        if(tiny){
            text(w<90?"21K JOD":"21K · YOU PAY",pad,pad+9,9,w-pad*2,BROWN,true);
            text(w<105 && valid?String.format(Locale.US,"%.2f",data.optDouble("price")):value,pad,Math.min(h-pad,pad+32),Math.min(24,w*.23f),w-pad*2,INK,true);
            return;
        }
        float pillWidth=Math.min(130,w-pad*2);
        gradient(pad,pad,pillWidth,25,13,0xffffe8ba,0xffffd399);border(pad,pad,pillWidth,25,13,0xddfff7e6,.8f);
        for(int i=0;i<3;i++)rounded(pad+10+i*5,pad+17-(i+1)*4,3,(i+1)*4,1.5f,0xffe99b05);
        text("21K GOLD",pad+31,pad+17,12,pillWidth-37,0xff80511f,true);
        boolean pot=showsPot((int)w,(int)h);
        float priceWidth=w-pad*2-(pot?104:0);
        text(value,pad,pad+59,Math.min(37,w*.107f),priceWidth,INK,true);
        JSONArray history=valid?data.optJSONArray("history"):null;
        java.util.ArrayList<JSONObject> points=new java.util.ArrayList<>();
        if(history!=null)for(int i=0;i<history.length();i++){JSONObject point=history.optJSONObject(i);if(point!=null&&Double.isFinite(point.optDouble("price"))&&point.optDouble("price")>0&&Double.isFinite(point.optDouble("timestamp")))points.add(point);}
        points.sort(Comparator.comparingDouble(point->point.optDouble("timestamp")));
        if(points.size()>30)points=new java.util.ArrayList<>(points.subList(points.size()-30,points.size()));
        float chipWidth=Math.min(priceWidth,188);
        String change="You pay · before workmanship";
        int changeInk=BROWN,changeBg=0x22dda96f;
        if(points.size()>1){double first=points.get(0).optDouble("price"),last=points.get(points.size()-1).optDouble("price"),delta=last-first;change=String.format(Locale.US,"%s%.2f%%  (JOD %s%.2f)",delta>=0?"+":"",delta/first*100,delta>=0?"+":"",delta);changeInk=delta>=0?0xff14852b:0xffa64c2e;changeBg=delta>=0?0xffd3ebc2:0xffffdfce;}
        rounded(pad,pad+70,chipWidth,23,12,changeBg);text(change,pad+8,pad+85,11,chipWidth-16,changeInk,true);
        if(h>=160)text("You pay · excl. workmanship",pad,pad+107,9,priceWidth,BROWN,false);
        float chartTop=pad+(pot?126:119),chartBottom=h-pad-27;
        if(chartBottom-chartTop>=28){
            if(points.size()>1)chart(points,chartTop,chartBottom);
            else text(valid?"Daily history builds as you save quotes":"Open app to load retail prices",pad,(chartTop+chartBottom)/2+4,11,w-pad*2,BROWN,false);
        }
        if(h>=145){
            fill(0x35c38d5a);c.drawRect(pad,h-pad-17,w-pad,h-pad-16,p);
            String checked=data.optString("updatedAt","");text(checked.isEmpty()?"Open app for retail quote":"Checked "+checked,pad,h-pad,10,w-pad*2,BROWN,false);
        }
    }
    private void chart(java.util.List<JSONObject> points,float top,float bottom){
        float right=w-pad-(w>=240?37:0),width=right-pad;
        double min=Double.POSITIVE_INFINITY,max=Double.NEGATIVE_INFINITY;
        for(JSONObject point:points){min=Math.min(min,point.optDouble("price"));max=Math.max(max,point.optDouble("price"));}
        double spread=Math.max(.1,max-min);min-=spread*.15;max+=spread*.15;
        for(int i=0;i<3;i++){
            float y=top+(bottom-top)*i/2;fill(0x4addb386);p.setStrokeWidth(.7f);p.setPathEffect(new DashPathEffect(new float[]{2,2},0));c.drawLine(pad,y,right,y,p);p.setPathEffect(null);
            if(w>=240)text(String.format(Locale.US,"%.2f",max-(max-min)*i/2),right+8,y+3,9,30,BROWN,false);
        }
        double first=points.get(0).optDouble("timestamp"),duration=points.get(points.size()-1).optDouble("timestamp")-first;
        if(duration<=0)return;
        Path line=new Path();float px=0,py=0;
        for(int i=0;i<points.size();i++){
            JSONObject point=points.get(i);float x=pad+width*(float)((point.optDouble("timestamp")-first)/duration),y=bottom-(bottom-top)*(float)((point.optDouble("price")-min)/(max-min));
            if(i==0)line.moveTo(x,y);else line.cubicTo((px+x)/2,py,(px+x)/2,y,x,y);px=x;py=y;
        }
        Path area=new Path(line);area.lineTo(right,bottom);area.lineTo(pad,bottom);area.close();fill(0xffffc12e);p.setShader(new LinearGradient(0,top,0,bottom,0xaaffc12e,0x08ffc12e,Shader.TileMode.CLAMP));c.drawPath(area,p);p.setShader(null);
        fill(0xffefa000);p.setStrokeWidth(2);p.setStyle(Paint.Style.STROKE);c.drawPath(line,p);p.setStyle(Paint.Style.FILL);fill(Color.WHITE);c.drawCircle(px,py,4,p);fill(0xffffb000);c.drawCircle(px,py,2.7f,p);
    }
}
