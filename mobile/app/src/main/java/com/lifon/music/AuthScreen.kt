package com.lifon.music

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private const val BASE_URL = ApiConfig.BASE

private enum class AuthStep { USERNAME, PASSWORD, SET_PASSWORD }

@Composable
fun AuthScreen(onAuthSuccess: (token: String) -> Unit) {
    var step by remember { mutableStateOf(AuthStep.USERNAME) }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val alpha = remember { Animatable(0f) }
    val slideY = remember { Animatable(30f) }
    LaunchedEffect(Unit) {
        launch { alpha.animateTo(1f, tween(500, easing = FastOutSlowInEasing)) }
        launch { slideY.animateTo(0f, tween(500, easing = FastOutSlowInEasing)) }
    }

    val bg = Brush.verticalGradient(
        colorStops = arrayOf(
            0.0f to Color(0xFF1A1A1F),
            0.5f to Color(0xFF111114),
            1.0f to Color(0xFF080809)
        )
    )

    Box(Modifier.fillMaxSize().background(bg)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 28.dp)
                .offset(y = slideY.value.dp)
                .graphicsLayer { this.alpha = alpha.value },
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.weight(0.15f))

            when (step) {

                // ── Шаг 1: ввод ника ─────────────────────────────────────────
                AuthStep.USERNAME -> {
                    Text("Войти", color = Color.White, fontWeight = FontWeight.Black,
                        fontSize = 30.sp, letterSpacing = (-0.5).sp)
                    Spacer(Modifier.height(6.dp))
                    Text("LifonMUSIC", color = Color(0xFFE8D5FF).copy(alpha = 0.45f),
                        fontSize = 13.sp, letterSpacing = 2.sp)
                    Spacer(Modifier.height(40.dp))

                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it; errorMsg = null },
                        singleLine = true,
                        placeholder = { Text("Имя пользователя", color = Color.White.copy(alpha = 0.35f), fontSize = 14.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = textFieldColors(),
                        shape = RoundedCornerShape(16.dp)
                    )

                    AnimatedVisibility(visible = errorMsg != null) {
                        Text(errorMsg.orEmpty(), color = Color(0xFFFF6B8A), fontSize = 13.sp,
                            modifier = Modifier.padding(top = 10.dp))
                    }

                    Spacer(Modifier.height(24.dp))

                    PrimaryButton(
                        text = if (isLoading) "..." else "Продолжить",
                        enabled = !isLoading
                    ) {
                        val u = username.trim().lowercase()
                        if (u.isBlank()) { errorMsg = "Введи имя пользователя"; return@PrimaryButton }
                        scope.launch {
                            isLoading = true; errorMsg = null
                            when (val result = checkUsername(u)) {
                                is UsernameCheckResult.NeedsPassword -> {
                                    step = AuthStep.SET_PASSWORD
                                    password = ""; confirmPassword = ""
                                }
                                is UsernameCheckResult.HasPassword -> {
                                    step = AuthStep.PASSWORD
                                    password = ""
                                }
                                is UsernameCheckResult.Error -> errorMsg = result.message
                            }
                            isLoading = false
                        }
                    }

                    Spacer(Modifier.height(24.dp))

                    SecondaryButton(
                        title = "Войти как гость",
                        subtitle = "Вы не сможете получать статистику о своих прослушиваниях",
                        enabled = !isLoading
                    ) { onAuthSuccess("guest") }
                }

                // ── Шаг 2а: ввод существующего пароля ───────────────────────
                AuthStep.PASSWORD -> {
                    Text("Добро пожаловать", color = Color.White, fontWeight = FontWeight.Black,
                        fontSize = 26.sp, letterSpacing = (-0.5).sp)
                    Spacer(Modifier.height(6.dp))
                    Text(username, color = Color(0xFFE8D5FF).copy(alpha = 0.55f),
                        fontSize = 15.sp, letterSpacing = 0.5.sp)
                    Spacer(Modifier.height(40.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it; errorMsg = null },
                        singleLine = true,
                        placeholder = { Text("Пароль", color = Color.White.copy(alpha = 0.35f), fontSize = 14.sp) },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        colors = textFieldColors(),
                        shape = RoundedCornerShape(16.dp)
                    )

                    AnimatedVisibility(visible = errorMsg != null) {
                        Text(errorMsg.orEmpty(), color = Color(0xFFFF6B8A), fontSize = 13.sp,
                            modifier = Modifier.padding(top = 10.dp))
                    }

                    Spacer(Modifier.height(24.dp))

                    PrimaryButton(
                        text = if (isLoading) "..." else "Войти",
                        enabled = !isLoading
                    ) {
                        scope.launch {
                            isLoading = true; errorMsg = null
                            when (val r = authRequest(username.trim().lowercase(), password)) {
                                is AuthResult.Success -> onAuthSuccess(r.token)
                                is AuthResult.Error -> errorMsg = r.message
                            }
                            isLoading = false
                        }
                    }

                    Spacer(Modifier.height(16.dp))
                    BackLink { step = AuthStep.USERNAME; password = ""; errorMsg = null }
                }

                // ── Шаг 2б: установка нового пароля ─────────────────────────
                AuthStep.SET_PASSWORD -> {
                    Text("Придумай пароль", color = Color.White, fontWeight = FontWeight.Black,
                        fontSize = 26.sp, letterSpacing = (-0.5).sp)
                    Spacer(Modifier.height(6.dp))
                    Text("Привет, $username! Создай пароль для входа",
                        color = Color(0xFFE8D5FF).copy(alpha = 0.45f),
                        fontSize = 13.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    Spacer(Modifier.height(40.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it; errorMsg = null },
                        singleLine = true,
                        placeholder = { Text("Новый пароль (мин. 8 символов)", color = Color.White.copy(alpha = 0.35f), fontSize = 14.sp) },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        colors = textFieldColors(),
                        shape = RoundedCornerShape(16.dp)
                    )

                    Spacer(Modifier.height(12.dp))

                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it; errorMsg = null },
                        singleLine = true,
                        placeholder = { Text("Повтори пароль", color = Color.White.copy(alpha = 0.35f), fontSize = 14.sp) },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        colors = textFieldColors(),
                        shape = RoundedCornerShape(16.dp)
                    )

                    AnimatedVisibility(visible = errorMsg != null) {
                        Text(errorMsg.orEmpty(), color = Color(0xFFFF6B8A), fontSize = 13.sp,
                            modifier = Modifier.padding(top = 10.dp))
                    }

                    Spacer(Modifier.height(24.dp))

                    PrimaryButton(
                        text = if (isLoading) "..." else "Сохранить и войти",
                        enabled = !isLoading
                    ) {
                        if (password.length < 8) { errorMsg = "Пароль слишком короткий (мин. 8 символов)"; return@PrimaryButton }
                        if (password != confirmPassword) { errorMsg = "Пароли не совпадают"; return@PrimaryButton }
                        scope.launch {
                            isLoading = true; errorMsg = null
                            when (val r = authRequest(username.trim().lowercase(), password)) {
                                is AuthResult.Success -> onAuthSuccess(r.token)
                                is AuthResult.Error -> errorMsg = r.message
                            }
                            isLoading = false
                        }
                    }

                    Spacer(Modifier.height(16.dp))
                    BackLink { step = AuthStep.USERNAME; password = ""; confirmPassword = ""; errorMsg = null }
                }
            }

            Spacer(Modifier.weight(1f))
        }
    }
}

// ── Вспомогательные Composable ────────────────────────────────────────────────

@Composable
private fun textFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    focusedBorderColor = Color(0xFFE8D5FF).copy(alpha = 0.40f),
    unfocusedBorderColor = Color.White.copy(alpha = 0.12f),
    cursorColor = Color.White,
    focusedContainerColor = Color.White.copy(alpha = 0.06f),
    unfocusedContainerColor = Color.White.copy(alpha = 0.04f)
)

@Composable
private fun PrimaryButton(text: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(if (enabled) Color.White else Color.White.copy(alpha = 0.5f))
            .clickable(enabled = enabled, indication = null,
                interactionSource = remember { MutableInteractionSource() }) { onClick() }
            .padding(vertical = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 16.sp)
    }
}

@Composable
private fun SecondaryButton(title: String, subtitle: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White.copy(alpha = 0.04f))
            .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(18.dp))
            .clickable(enabled = enabled, indication = null,
                interactionSource = remember { MutableInteractionSource() }) { onClick() }
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, color = Color.White.copy(alpha = 0.55f),
                fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Spacer(Modifier.height(3.dp))
            Text(subtitle, color = Color.White.copy(alpha = 0.28f), fontSize = 11.sp,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp))
        }
    }
}

@Composable
private fun BackLink(onClick: () -> Unit) {
    Text(
        "← Назад",
        color = Color.White.copy(alpha = 0.35f),
        fontSize = 13.sp,
        modifier = Modifier
            .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { onClick() }
            .padding(vertical = 4.dp)
    )
}

// ── Логика запросов ────────────────────────────────────────────────────────────

sealed class AuthResult {
    data class Success(val token: String) : AuthResult()
    data class Error(val message: String) : AuthResult()
}

sealed class UsernameCheckResult {
    object NeedsPassword : UsernameCheckResult()
    object HasPassword : UsernameCheckResult()
    data class Error(val message: String) : UsernameCheckResult()
}

/** Шаг 1: отправляем только username, выясняем нужно ли задавать пароль. */
suspend fun checkUsername(username: String): UsernameCheckResult {
    return withContext(Dispatchers.IO) {
        var conn: HttpURLConnection? = null
        try {
            conn = (URL("$BASE_URL/auth/login").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connectTimeout = 8000; readTimeout = 8000; doOutput = true
            }
            val body = JSONObject().put("username", username).toString()
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val obj = runCatching { JSONObject(text) }.getOrNull()

            when {
                obj?.optBoolean("needs_password", false) == true -> UsernameCheckResult.NeedsPassword
                obj?.optString("error") == "password_required" -> UsernameCheckResult.HasPassword
                obj?.optString("error") == "invalid_credentials" -> UsernameCheckResult.Error("Аккаунта с таким ником нет. Для регистрации — войди через браузер")
                obj?.optString("error") == "telegram_only" -> UsernameCheckResult.Error("Этот аккаунт входит только через Telegram")
                else -> UsernameCheckResult.Error("Ошибка (код $code)")
            }
        } catch (_: Exception) {
            UsernameCheckResult.Error("Нет соединения")
        } finally {
            conn?.disconnect()
        }
    }
}

/** Шаг 2: username + password (обычный вход ИЛИ первичная установка пароля). */
suspend fun authRequest(username: String, password: String): AuthResult {
    return withContext(Dispatchers.IO) {
        var conn: HttpURLConnection? = null
        try {
            conn = (URL("$BASE_URL/auth/login").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connectTimeout = 8000; readTimeout = 8000; doOutput = true
            }
            val body = JSONObject().put("username", username).put("password", password).toString()
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val obj = runCatching { JSONObject(text) }.getOrNull()
            val ok = obj?.optBoolean("ok", false) ?: false

            if (code in 200..299 && ok) {
                val token = obj?.optString("token", null)
                if (!token.isNullOrBlank()) return@withContext AuthResult.Success(token)
                return@withContext AuthResult.Error("Сервер не вернул token")
            }

            val error = obj?.optString("error")
            val msg = when (error) {
                "telegram_only"      -> "Этот аккаунт входит только через Telegram"
                "invalid_credentials"-> "Неверный пароль"
                "account_locked"     -> "Слишком много попыток. Попробуй позже"
                "invalid_input"      -> obj?.optString("message")?.takeIf { it.isNotBlank() } ?: "Некорректные данные"
                else -> obj?.optString("message")?.takeIf { it.isNotBlank() }
                    ?: if (code == 401) "Неверный пароль" else "Ошибка сервера ($code)"
            }
            AuthResult.Error(msg)
        } catch (_: Exception) {
            AuthResult.Error("Нет соединения")
        } finally {
            conn?.disconnect()
        }
    }
}
