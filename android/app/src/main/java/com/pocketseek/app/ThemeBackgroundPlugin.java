package com.pocketseek.app;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.Window;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 把窗口底色同步为网页主题色。
 * WebView 不绘制状态栏/手势栏的 inset，窗口底色决定这两条区域的颜色；
 * Android 15+ 起 setStatusBarColor 已不生效，因此优先改 window background。
 */
@CapacitorPlugin(name = "ThemeBackground")
public class ThemeBackgroundPlugin extends Plugin {
    @PluginMethod
    public void setColor(PluginCall call) {
        String value = call.getString("color");
        if (value == null) {
            call.reject("color is required");
            return;
        }
        final int color;
        try {
            color = Color.parseColor(value);
        } catch (IllegalArgumentException error) {
            call.reject("invalid color", error);
            return;
        }
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            window.setBackgroundDrawable(new ColorDrawable(color));
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                window.setStatusBarColor(color);
                window.setNavigationBarColor(color);
            }
            call.resolve();
        });
    }
}
