package com.albunyan.rental;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// In-app update: downloads the new APK (same signing key as the installed one, so it
// installs as an update and keeps the data) and opens Android's installer — Android
// always asks for one confirmation. Copied from the old app's tablet.
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

  @PluginMethod
  public void downloadAndInstall(PluginCall call) {
    String url = call.getString("url");
    if (url == null) {
      call.reject("missing url");
      return;
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
      Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
      settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(settings);
      call.reject("NEEDS_PERMISSION");
      return;
    }
    new Thread(() -> {
      try {
        File out = new File(getContext().getCacheDir(), "update.apk");
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(60000);
        conn.connect();
        if (conn.getResponseCode() >= 400) throw new Exception("HTTP " + conn.getResponseCode());
        long total = conn.getContentLengthLong();
        try (InputStream in = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(out)) {
          byte[] buf = new byte[65536];
          long done = 0;
          int lastPercent = -1;
          int n;
          while ((n = in.read(buf)) > 0) {
            fos.write(buf, 0, n);
            done += n;
            if (total > 0) {
              int percent = (int) (done * 100 / total);
              if (percent != lastPercent) {
                lastPercent = percent;
                JSObject progress = new JSObject();
                progress.put("percent", percent);
                notifyListeners("progress", progress);
              }
            }
          }
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", out);
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(install);
        call.resolve();
      } catch (Exception e) {
        call.reject(e.getMessage() == null ? "download failed" : e.getMessage());
      }
    }).start();
  }
}
