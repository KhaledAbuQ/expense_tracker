package com.householdledger.expenses;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;

public class SmsBroadcastReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsBroadcastReceiver";
    public static final String PREFS_NAME = "PocketExpensesSmsPrefs";
    public static final String PREF_PENDING_SMS = "pending_sms_list";
    public static final String PREF_MODE = "sms_mode"; // "approval" | "auto"
    public static final String PREF_NOTIFY = "notify_every_transaction"; // boolean
    public static final String NOTIFICATION_CHANNEL_ID = "bank_sms_transactions";
    public static final String ACTION_SMS_APPROVAL = "com.householdledger.expenses.ACTION_SMS_APPROVAL";

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

            // Notify BankSmsPlugin if active in foreground
            BankSmsPlugin.notifyIncomingSms(address, body, timestamp);

            // Check if notification should be dispatched for this transaction
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String mode = prefs.getString(PREF_MODE, "approval");
            boolean notifyPref = prefs.getBoolean(PREF_NOTIFY, true);

            if (notifyPref && isLikelyBankTransaction(body)) {
                showTransactionNotification(context, address, body, timestamp, mode);
            }

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

    public static boolean isLikelyBankTransaction(String body) {
        if (body == null || body.trim().isEmpty()) return false;
        String lower = body.toLowerCase();
        // Ignore OTP / verification security codes
        if (lower.contains("otp") || lower.contains("verification code") || lower.contains("رمز التحقق") || lower.contains("do not share")) {
            return false;
        }
        boolean hasCurrency = lower.contains("jod") || lower.contains("jd") || lower.contains("د.أ") || lower.contains("دينار") ||
            lower.contains("usd") || lower.contains("$") || lower.contains("eur") || lower.contains("sar") || lower.contains("aed");
        boolean hasAction = lower.contains("debited") || lower.contains("credited") || lower.contains("purchase") ||
            lower.contains("spent") || lower.contains("paid") || lower.contains("cliq") || lower.contains("transfer") ||
            lower.contains("deposit") || lower.contains("شراء") || lower.contains("خصم") || lower.contains("إيداع") ||
            lower.contains("ايداع") || lower.contains("سحب") || lower.contains("قيد");
        return hasCurrency && hasAction;
    }

    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Bank SMS Transactions",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications for bank transactions to review and approve");
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @SuppressWarnings("MissingPermission")
    private static void showTransactionNotification(Context context, String address, String body, long timestamp, String mode) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "POST_NOTIFICATIONS permission not granted, skipping notification");
                    return;
                }
            }

            createNotificationChannel(context);

            Intent notifyIntent = new Intent(context, MainActivity.class);
            notifyIntent.setAction(ACTION_SMS_APPROVAL);
            notifyIntent.putExtra("open_sms_approval", true);
            notifyIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                (int) (timestamp % 100000),
                notifyIntent,
                pendingFlags
            );

            boolean isAuto = "auto".equalsIgnoreCase(mode);
            String title = isAuto
                ? "Pocket Expenses: Bank Transaction Auto-Tracked"
                : "Pocket Expenses: Bank Transaction Detected";

            String contentText = isAuto
                ? "New bank transaction recorded. Tap to view ledger."
                : "New bank transaction waiting for your approval. Tap to review.";

            int smallIcon = context.getApplicationInfo().icon != 0 ? context.getApplicationInfo().icon : android.R.drawable.stat_notify_chat;

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(smallIcon)
                .setContentTitle(title)
                .setContentText(contentText)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            notificationManager.notify((int) (timestamp % 100000), builder.build());
        } catch (SecurityException se) {
            Log.w(TAG, "Notification permission not granted yet", se);
        } catch (Exception e) {
            Log.e(TAG, "Failed to post bank SMS notification", e);
        }
    }
}

