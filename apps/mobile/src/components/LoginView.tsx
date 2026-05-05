import React, { useState } from 'react';
import {
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, DARK_COLORS } from '../constants/theme';
import { createStyles } from '../styles/global';

interface LoginViewProps {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  handleLogin: () => void;
  loading: boolean;
  apiReady: boolean;
  apiUrl: string;
  apiUrlDraft: string;
  setApiUrlDraft: (v: string) => void;
  onSaveApiUrl: () => void;
  onResetApiUrl: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  username,
  setUsername,
  password,
  setPassword,
  handleLogin,
  loading,
  apiReady,
  apiUrl,
  apiUrlDraft,
  setApiUrlDraft,
  onSaveApiUrl,
  onResetApiUrl
}) => {
  const isDark = useColorScheme() === 'dark';
  const styles = createStyles(isDark);
  const theme = isDark ? DARK_COLORS : COLORS;
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showApiSettings, setShowApiSettings] = useState(false);

  const fieldState = (field: string) => (
    focusedField === field
      ? { borderColor: theme.blue, backgroundColor: theme.white }
      : null
  );

  const iconState = (field: string) => (
    focusedField === field
      ? { backgroundColor: theme.blueSoft }
      : null
  );

  return (
    <View style={styles.loginContainer}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.slate} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, width: '100%' }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingTop: 44,
            paddingBottom: 32,
            paddingHorizontal: 20
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.loginHeader}>
            <View style={styles.loginLogoCard}>
              <Image source={require('../../assets/logo.png')} style={styles.loginLogo} resizeMode="contain" />
            </View>
            <Text style={styles.loginWelcomeTitle}>Fuvex Manager</Text>
            <Text style={styles.loginWelcomeSubtitle}>
              Gestion comercial BCP
            </Text>
          </View>

          <View style={styles.loginCard}>
            <View style={styles.loginCardHeader}>
              <Text style={styles.loginEyebrow}>ACCESO CORPORATIVO</Text>
              <Text style={styles.loginCardTitle}>Bienvenido</Text>
              <Text style={styles.loginCardSubtitle}>Ingresa con tu usuario asignado para continuar.</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>USUARIO</Text>
              <View style={[styles.inputWrapper, fieldState('username')]}>
                <View style={[styles.loginIconBox, iconState('username')]}>
                  <Ionicons
                    name="person"
                    size={18}
                    color={focusedField === 'username' ? theme.blue : theme.subtext}
                  />
                </View>
                <TextInput
                  style={styles.loginInput}
                  placeholder="Ej: jperalta"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  placeholderTextColor={theme.muted}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>CONTRASENA</Text>
              <View style={[styles.inputWrapper, fieldState('password')]}>
                <View style={[styles.loginIconBox, iconState('password')]}>
                  <Ionicons
                    name="lock-closed"
                    size={18}
                    color={focusedField === 'password' ? theme.blue : theme.subtext}
                  />
                </View>
                <TextInput
                  style={styles.loginInput}
                  placeholder="********"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholderTextColor={theme.muted}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.subtext} />
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={{
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surfaceAlt,
                borderRadius: 12,
                padding: 12,
                marginBottom: 16
              }}
            >
              <TouchableOpacity
                onPress={() => setShowApiSettings(!showApiSettings)}
                style={{ flexDirection: 'row', alignItems: 'center' }}
                activeOpacity={0.82}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>API</Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: apiUrl ? theme.subtext : theme.rose,
                      fontWeight: '700',
                      marginTop: 3
                    }}
                    numberOfLines={1}
                  >
                    {apiReady ? (apiUrl || 'Sin configurar') : 'Cargando...'}
                  </Text>
                </View>
                <Ionicons
                  name={showApiSettings ? 'chevron-up' : 'settings-outline'}
                  size={20}
                  color={theme.blue}
                />
              </TouchableOpacity>

              {showApiSettings && (
                <View style={{ marginTop: 12 }}>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.input,
                      color: theme.text,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: 12,
                      fontWeight: '700'
                    }}
                    value={apiUrlDraft}
                    onChangeText={setApiUrlDraft}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="https://tu-ngrok.ngrok-free.dev/api"
                    placeholderTextColor={theme.muted}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      onPress={onSaveApiUrl}
                      style={{
                        flex: 1,
                        minHeight: 38,
                        borderRadius: 9,
                        backgroundColor: theme.blue,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Text style={{ color: theme.whiteText, fontSize: 11, fontWeight: '900' }}>
                        GUARDAR
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={onResetApiUrl}
                      style={{
                        flex: 1,
                        minHeight: 38,
                        borderRadius: 9,
                        backgroundColor: theme.white,
                        borderWidth: 1,
                        borderColor: theme.border,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Text style={{ color: theme.blue, fontSize: 11, fontWeight: '900' }}>
                        AUTO
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && { opacity: 0.72 }]}
              onPress={handleLogin}
              disabled={loading || !apiReady}
              activeOpacity={0.86}
            >
              {loading ? (
                <ActivityIndicator color={theme.whiteText} size="small" />
              ) : (
                <View style={styles.loginBtnContent}>
                  <Text style={styles.loginBtnText}>INICIAR SESION</Text>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      backgroundColor: 'rgba(255,255,255,0.16)',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Ionicons name="arrow-forward" size={18} color={theme.whiteText} />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.loginSecurityCard}>
              <Ionicons name="shield-checkmark" size={16} color={theme.emerald} style={{ marginRight: 8 }} />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '800',
                  color: theme.subtext,
                  letterSpacing: 0.3
                }}
              >
                Conexion segura y protegida
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Text style={styles.loginFooterText}>Version 2.1.0 - Fuvex 2026</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};
