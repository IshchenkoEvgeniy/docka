package app.doska

import android.app.Activity
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import java.io.ByteArrayOutputStream
import org.json.JSONObject

/** Ограничиваем поток до выделения base64, включая провайдеры без сведений о размере. */
internal fun readSharedFile(activity: Activity, uri: Uri, fallbackMime: String = "application/octet-stream"): JSONObject {
  val resolver = activity.contentResolver
  val mime = try { resolver.getType(uri) ?: fallbackMime } catch (error: Exception) { fallbackMime }
  val bytes = resolver.openInputStream(uri)?.use { input ->
    val result = ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    while (true) {
      val count = input.read(buffer)
      if (count < 0) break
      if (result.size() + count > 30 * 1024 * 1024) throw IllegalArgumentException("File exceeds 30 MB")
      result.write(buffer, 0, count)
    }
    result.toByteArray()
  } ?: throw IllegalArgumentException("File cannot be read")
  var name = "clipboard-image"
  // Некоторые clipboard-провайдеры отдают поток, но не поддерживают запрос имени.
  try {
    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) name = cursor.getString(0) ?: name
    }
  } catch (error: Exception) { /* Имя необязательно; уже прочитанный файл сохраняем. */ }
  return JSONObject().put("kind", "file").put("name", name).put("mime", mime)
    .put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
}
