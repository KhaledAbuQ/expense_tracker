package com.householdledger.expenses;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;

public class SmsBroadcastReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsBroadcastReceiver";
    public static final String PREFS_NAME = "PocketExpensesSmsPrefs";
    public static final String PREF_PENDING_SMS = "pending_sms_list";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        try {
            SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (messages == null || messages.length == 0) {
                return;
            }

            String address = messages[0].getDisplayOriginatingAddress();
            if (address == null) {
                address = messages[0].getOriginatingAddress();
            }
            long timestamp = messages[0].getTimestampMillis();

            StringBuilder bodyBuilder = new StringBuilder();
            for (SmsMessage msg : messages) {
                if (msg != null && msg.getMessageBody() != null) {
                    bodyBuilder.append(msg.getMessageBody());
                }
            }
            String body = bodyBuilder.toString();

            Log.d(TAG, "SMS received from: " + address);

            // Store into SharedPreferences for persistence even when app is killed/background
            storePendingSms(context, address, body, timestamp);

            // Notify BankSmsPlugin if active
            BankSmsPlugin.notifyIncomingSms(address, body, timestamp);

        } catch (Exception e) {
            Log.e(TAG, "Error handling incoming SMS", e);
        }
    }

    public static synchronized void storePendingSms(Context context, String address, String body, long timestamp) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString(PREF_PENDING_SMS, "[]");
            JSONArray array = new JSONArray(existingJson);

            JSONObject item = new JSONObject();
            item.put("id", "rcv_" + timestamp + "_" + Math.abs(address.hashCode()));
            item.put("address", address);
            item.put("body", body);
            item.put("date", timestamp);

            array.put(item);

            // Keep only latest 50 pending messages to prevent unbounded growth
            while (array.length() > 50) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    array.remove(0);
                } else {
                    break;
                }
            }

            prefs.edit().putString(PREF_PENDING_SMS, array.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed to store pending SMS", e);
        }
    }
}
