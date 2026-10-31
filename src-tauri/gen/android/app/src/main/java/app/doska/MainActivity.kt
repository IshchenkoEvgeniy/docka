package app.doska

import android.content.Intent
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private val bridge = DoskaBridge(this)

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    bridge.takeIntent(intent)
  }

  // «Поделиться → Доска», когда приложение уже открыто.
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    bridge.takeIntent(intent)
  }

  override fun onWebViewCreate(webView: WebView) {
    bridge.attach(webView)
    webView.addJavascriptInterface(bridge, "DoskaAndroid")
  }
}
