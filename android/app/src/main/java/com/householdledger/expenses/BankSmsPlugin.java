package com.householdledger.expenses;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.Telephony;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "BankSms",
    permissions = {
        @Permission(
            alias = "sms",
            strings = {
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS
            }
        )
    }
)
public class BankSmsPlugin extends Plugin {
    private static final String TAG = "BankSmsPlugin";
    private static BankSmsPlugin activeInstance;

    @Override
    public void load() {
        super.load();
        activeInstance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (activeInstance == this) {
            activeInstance = null;
        }
        super.handleOnDestroy();
    }

    public static void notifyIncomingSms(String address, String body, long timestamp) {
        if (activeInstance != null) {
            try {
                JSObject data = new JSObject();
                data.put("id", "live_" + timestamp + "_" + Math.abs(address.hashCode()));
                data.put("address", address);
                data.put("body", body);
                data.put("date", timestamp);
                activeInstance.notifyListeners("smsReceived", data);
            } catch (Exception e) {
                Log.e(TAG, "Failed to dispatch smsReceived listener event", e);
            }
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        ret.put("platform", "android");
        call.resolve(ret);
    }

    @PluginMethod
    public void checkSmsPermissions(PluginCall call) {
        Context context = getContext();
        boolean hasReceive = ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean hasRead = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("granted", hasReceive && hasRead);
        ret.put("receiveSms", hasReceive);
        ret.put("readSms", hasRead);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestSmsPermissions(PluginCall call) {
        Context context = getContext();
        boolean hasReceive = ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean hasRead = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;

        if (hasReceive && hasRead) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("receiveSms", true);
            ret.put("readSms", true);
            call.resolve(ret);
            return;
        }

        requestPermissionForAlias("sms", call, "smsPermsCallback");
    }

    @PermissionCallback
    private void smsPermsCallback(PluginCall call) {
        Context context = getContext();
        boolean hasReceive = ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean hasRead = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("granted", hasReceive && hasRead);
        ret.put("receiveSms", hasReceive);
        ret.put("readSms", hasRead);
        call.resolve(ret);
    }

    @PluginMethod
    public void getRecentSms(PluginCall call) {
        Context context = getContext();
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Permission READ_SMS is not granted");
            return;
        }

        int limit = call.getInt("limit", 50);
        int days = call.getInt("days", 30);
        long minDate = System.currentTimeMillis() - ((long) days * 24L * 60L * 60L * 1000L);

        JSArray messages = new JSArray();
        Cursor cursor = null;

        try {
            ContentResolver cr = context.getContentResolver();
            Uri inboxUri = Telephony.Sms.Inbox.CONTENT_URI;
            String[] projection = new String[] { "_id", "address", "body", "date" };
            String selection = "date >= ?";
            String[] selectionArgs = new String[] { String.valueOf(minDate) };
            String sortOrder = "date DESC LIMIT " + limit;

            cursor = cr.query(inboxUri, projection, selection, selectionArgs, sortOrder);
            if (cursor != null && cursor.moveToFirst()) {
                int idIdx = cursor.getColumnIndex("_id");
                int addressIdx = cursor.getColumnIndex("address");
                int bodyIdx = cursor.getColumnIndex("body");
                int dateIdx = cursor.getColumnIndex("date");

                do {
                    String id = idIdx >= 0 ? cursor.getString(idIdx) : "";
                    String address = addressIdx >= 0 ? cursor.getString(addressIdx) : "";
                    String body = bodyIdx >= 0 ? cursor.getString(bodyIdx) : "";
                    long date = dateIdx >= 0 ? cursor.getLong(dateIdx) : System.currentTimeMillis();

                    JSObject msg = new JSObject();
                    msg.put("id", id);
                    msg.put("address", address);
                    msg.put("body", body);
                    msg.put("date", date);
                    messages.put(msg);
                } while (cursor.moveToNext());
            }

            JSObject ret = new JSObject();
            ret.put("messages", messages);
            ret.put("count", messages.length());
            call.resolve(ret);

        } catch (Exception e) {
            Log.e(TAG, "Error querying SMS inbox", e);
            call.reject("Failed to query SMS inbox: " + e.getMessage());
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }

    @PluginMethod
    public void getPendingReceivedSms(PluginCall call) {
        Context context = getContext();
        try {
            SharedPreferences prefs = context.getSharedPreferences(SmsBroadcastReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            String rawJson = prefs.getString(SmsBroadcastReceiver.PREF_PENDING_SMS, "[]");
            JSONArray array = new JSONArray(rawJson);

            JSArray messages = new JSArray();
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                JSObject item = new JSObject();
                item.put("id", obj.optString("id"));
                item.put("address", obj.optString("address"));
                item.put("body", obj.optString("body"));
                item.put("date", obj.optLong("date"));
                messages.put(item);
            }

            JSObject ret = new JSObject();
            ret.put("messages", messages);
            ret.put("count", messages.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read pending SMS: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearPendingReceivedSms(PluginCall call) {
        Context context = getContext();
        try {
            SharedPreferences prefs = context.getSharedPreferences(SmsBroadcastReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(SmsBroadcastReceiver.PREF_PENDING_SMS, "[]").apply();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to clear pending SMS: " + e.getMessage());
        }
    }
}
