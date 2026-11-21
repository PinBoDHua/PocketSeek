package com.pocketseek.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** Capacitor 在 onCreate 内部会调用一次 onNewIntent(启动 Intent)，此时由 onCreate 统一登记。 */
    private boolean binding = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThemeBackgroundPlugin.class);
        registerPlugin(ShareReceiverPlugin.class);
        binding = true;
        super.onCreate(savedInstanceState);
        binding = false;
        // 仅冷启动登记；旋转等重建不能把启动分享再取一次。
        if (savedInstanceState == null) {
            captureShare(getIntent());
        }
        // 清掉启动 Intent，避免重建或 Capacitor 再次转发时重复分享。
        setIntent(new Intent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (binding) {
            return;
        }
        setIntent(new Intent());
        captureShare(intent);
    }

    private void captureShare(Intent intent) {
        if (ShareReceiverPlugin.capture(this, intent) && getBridge() != null) {
            getBridge().triggerJSEvent("pocketseekShare", "window", "{}");
        }
    }
}
