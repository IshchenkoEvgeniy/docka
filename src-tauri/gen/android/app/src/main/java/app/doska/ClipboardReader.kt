package app.doska

import android.app.Activity
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject

/** ClipboardManager вызывается при явном действии в видимом окне, на UI-потоке. */
internal class ClipboardReader(private val activity: Activity, private val view: () -> WebView?) {
  fun read(requestId: String) {
    activity.runOnUiThread {
      try {
        val manager = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = manager.primaryClip
        // Провайдеры изображений могут быть медленными: не блокируем интерфейс чтением файла.
        Thread {
          val result = JSONObject().put("id", requestId)
          if (clip != null && Build.VERSION.SDK_INT >= 26) result.put("changedAt", clip.description.timestamp)
          try {
            val items = JSONArray()
            if (clip != null) {
              for (index in 0 until clip.itemCount) {
                val item = clip.getItemAt(index)
                val uri = item.uri
                if (uri != null && uri.scheme == "content") {
                  val description = clip.description
                  val mime = (0 until description.mimeTypeCount).map { description.getMimeType(it) }
                    .firstOrNull { it.startsWith("image/") } ?: "application/octet-stream"
                  items.put(readSharedFile(activity, uri, mime))
                } else if (item.text != null) {
                  items.put(JSONObject().put("kind", "text").put("text", item.text.toString()))
                }
              }
            }
            result.put("items", items)
          } catch (error: Exception) {
            result.put("error", error.message ?: "Clipboard cannot be read")
          }
          reply(result)
        }.start()
      } catch (error: Exception) {
        reply(JSONObject().put("id", requestId).put("error", error.message ?: "Clipboard unavailable"))
      }
    }
  }

  private fun reply(result: JSONObject) {
    val encoded = JSONObject.quote(result.toString())
    view()?.post {
      view()?.evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('doska-clipboard-result',{detail:JSON.parse($encoded)}))", null,
      )
    }
  }
}
