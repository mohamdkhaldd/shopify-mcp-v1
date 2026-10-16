package com.albunyan.tablet;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// طباعة الصفحة الحالية بنظام الطباعة بتاع أندرويد (أي طابعة أو "حفظ PDF")
// على ورق A4 — بنفس شكل الطباعة بتاع اللاب (CSS الطباعة نفسه).
@CapacitorPlugin(name = "Printer")
public class PrinterPlugin extends Plugin {
  @PluginMethod
  public void print(PluginCall call) {
    final String name = call.getString("name", "Al Bunyan");
    getActivity().runOnUiThread(() -> {
      try {
        WebView webView = getBridge().getWebView();
        PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
        PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(name);
        PrintAttributes attributes = new PrintAttributes.Builder()
          .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
          .build();
        printManager.print(name, adapter, attributes);
        call.resolve();
      } catch (Exception e) {
        call.reject(e.getMessage());
      }
    });
  }
}
