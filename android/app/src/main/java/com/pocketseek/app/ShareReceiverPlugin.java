package com.pocketseek.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * 接收系统分享的文本与图片。Intent 中只保存 URI，等 JS 主动取件时再读内容，
 * 避免在 Activity 生命周期回调里同步读取大图。
 */
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {
    private static final int MAX_IMAGES = 6;
    private static final int MAX_PENDING_IMAGES = 12;
    private static final int MAX_IMAGE_BYTES = 12 * 1024 * 1024;
    private static final long MAX_TOTAL_BYTES = 24L * 1024 * 1024;
    private static final int MAX_TEXT_CHARS = 100_000;
    private static final int MAX_PENDING_TEXTS = 20;
    private static final int MAX_PENDING_TEXT_CHARS = 200_000;
    private static final String TRUNCATED_TEXT_SUFFIX = "\n…（分享文本过长，已截断）";

    private static final Object LOCK = new Object();
    private static final List<String> PENDING_TEXTS = new ArrayList<>();
    private static final List<Uri> PENDING_URIS = new ArrayList<>();
    private static int pendingTextChars = 0;
    private static int pendingSkipped = 0;

    private static final class ImageRead {
        final byte[] bytes;
        final String name;
        final String mimeType;

        ImageRead(byte[] bytes, String name, String mimeType) {
            this.bytes = bytes;
            this.name = name;
            this.mimeType = mimeType;
        }
    }

    /**
     * 交给 JS 的载荷：文本 + 一次最多一张图片的 base64；hasMore 表示还有图片待取。
     * 每次只跨桥一张图，避免 24MB 图片同时编码成 base64 造成低端机 OOM。
     */
    @PluginMethod
    public void getPending(PluginCall call) {
        List<String> texts;
        Uri nextUri = null;
        int skipped;
        boolean hasMore;
        synchronized (LOCK) {
            texts = new ArrayList<>(PENDING_TEXTS);
            PENDING_TEXTS.clear();
            pendingTextChars = 0;
            if (!PENDING_URIS.isEmpty()) {
                nextUri = PENDING_URIS.remove(0);
            }
            hasMore = !PENDING_URIS.isEmpty();
            skipped = pendingSkipped;
            pendingSkipped = 0;
        }

        JSArray items = new JSArray();
        for (String text : texts) {
            JSObject item = new JSObject();
            item.put("type", "text");
            item.put("text", text);
            items.put(item);
        }

        if (nextUri != null) {
            ContentResolver resolver = getActivity().getContentResolver();
            ImageRead image;
            try {
                image = readImage(resolver, nextUri, MAX_TOTAL_BYTES);
            } catch (Exception error) {
                image = null;
            }
            if (image == null) {
                skipped++;
            } else {
                JSObject item = new JSObject();
                item.put("type", "image");
                item.put("name", image.name);
                item.put("mimeType", image.mimeType);
                item.put("data", Base64.encodeToString(image.bytes, Base64.NO_WRAP));
                items.put(item);
            }
        }

        JSObject result = new JSObject();
        result.put("items", items);
        result.put("skipped", skipped);
        result.put("hasMore", hasMore);
        call.resolve(result);
    }

    /** 只登记分享内容；返回是否有可交给 JS 的内容。 */
    public static boolean capture(Activity activity, Intent intent) {
        if (intent == null) {
            return false;
        }
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            return false;
        }

        String text = extractText(intent);
        if (text.length() > MAX_TEXT_CHARS) {
            text = text.substring(0, MAX_TEXT_CHARS) + TRUNCATED_TEXT_SUFFIX;
        }
        String type = intent.getType();
        List<Uri> uris =
                type != null && type.startsWith("image/") ? extractUris(intent) : new ArrayList<>();
        if (text.isEmpty() && uris.isEmpty()) {
            return false;
        }

        boolean queued = false;
        synchronized (LOCK) {
            if (!text.isEmpty()) {
                // 队列满或总字符超限时丢弃最旧的分享，保证最新内容可进入且内存有界。
                while (!PENDING_TEXTS.isEmpty()
                        && (PENDING_TEXTS.size() >= MAX_PENDING_TEXTS
                                || pendingTextChars + text.length() > MAX_PENDING_TEXT_CHARS)) {
                    pendingTextChars -= PENDING_TEXTS.remove(0).length();
                }
                if (pendingTextChars + text.length() <= MAX_PENDING_TEXT_CHARS) {
                    PENDING_TEXTS.add(text);
                    pendingTextChars += text.length();
                    queued = true;
                }
            }
            int imageCapacity =
                    Math.min(MAX_IMAGES, Math.max(0, MAX_PENDING_IMAGES - PENDING_URIS.size()));
            int take = Math.min(uris.size(), imageCapacity);
            for (int index = 0; index < take; index++) {
                PENDING_URIS.add(uris.get(index));
            }
            pendingSkipped += uris.size() - take;
            queued = queued || take > 0 || uris.size() > take;
        }
        return queued;
    }

    private static String extractText(Intent intent) {
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        CharSequence subject = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT);
        String body = text == null ? "" : text.toString().trim();
        if (body.isEmpty() && intent.getClipData() != null) {
            for (int index = 0; index < intent.getClipData().getItemCount(); index++) {
                CharSequence clipText = intent.getClipData().getItemAt(index).getText();
                if (clipText != null && !clipText.toString().trim().isEmpty()) {
                    body = clipText.toString().trim();
                    break;
                }
            }
        }
        String title = subject == null ? "" : subject.toString().trim();
        if (title.isEmpty() || body.contains(title)) {
            return body;
        }
        return body.isEmpty() ? title : title + "\n" + body;
    }

    private static List<Uri> extractUris(Intent intent) {
        List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
            ArrayList<Uri> shared = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (shared != null) {
                uris.addAll(shared);
            }
        } else {
            Uri shared = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (shared != null) {
                uris.add(shared);
            }
        }
        ClipData clip = intent.getClipData();
        if (clip != null) {
            for (int index = 0; index < clip.getItemCount(); index++) {
                Uri uri = clip.getItemAt(index).getUri();
                if (uri != null && !uris.contains(uri)) {
                    uris.add(uri);
                }
            }
        }
        return uris;
    }

    private static ImageRead readImage(ContentResolver resolver, Uri uri, long budget) {
        String mimeType = resolver.getType(uri);
        String name = queryDisplayName(resolver, uri);
        if (mimeType == null) {
            mimeType = mimeFromName(name);
        }
        if (mimeType == null || !mimeType.startsWith("image/")) {
            return null;
        }
        if (name == null || name.isEmpty()) {
            name = "share-image." + extensionFor(mimeType);
        }
        long limit = Math.min(MAX_IMAGE_BYTES, budget);
        if (limit <= 0) {
            return null;
        }
        try (InputStream stream = resolver.openInputStream(uri)) {
            if (stream == null) {
                return null;
            }
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            long total = 0;
            int read;
            while ((read = stream.read(chunk)) != -1) {
                total += read;
                if (total > limit) {
                    return null;
                }
                buffer.write(chunk, 0, read);
            }
            return new ImageRead(buffer.toByteArray(), name, mimeType);
        } catch (Exception error) {
            return null;
        }
    }

    private static String queryDisplayName(ContentResolver resolver, Uri uri) {
        try (Cursor cursor = resolver.query(
                uri,
                new String[] { OpenableColumns.DISPLAY_NAME },
                null,
                null,
                null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    return cursor.getString(index);
                }
            }
        } catch (Exception error) {
            // 部分分享方不暴露文件名，交给 JS 按 MIME 补后缀
        }
        return null;
    }

    private static String mimeFromName(String name) {
        if (name == null) {
            return null;
        }
        int dot = name.lastIndexOf('.');
        if (dot <= 0 || dot == name.length() - 1) {
            return null;
        }
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substring(dot + 1).toLowerCase());
    }

    private static String extensionFor(String mimeType) {
        switch (mimeType) {
            case "image/png":
                return "png";
            case "image/gif":
                return "gif";
            case "image/webp":
                return "webp";
            case "image/bmp":
                return "bmp";
            case "image/svg+xml":
                return "svg";
            case "image/tiff":
                return "tiff";
            case "image/avif":
                return "avif";
            default:
                return "jpg";
        }
    }
}
