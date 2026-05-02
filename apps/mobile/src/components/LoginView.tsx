import React from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, useColorScheme } from 'react-native';
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
}

export const LoginView: React.FC<LoginViewProps> = ({
  username, setUsername, password, setPassword, handleLogin, loading
}) => {
  const isDark = useColorScheme() === 'dark';
  const styles = createStyles(isDark);
  const theme = isDark ? DARK_COLORS : COLORS;

  return (
    <View style={styles.loginContainer}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.loginHeaderDecorator} />
      <View style={styles.loginFooterDecorator} />

      <View style={styles.loginHeader}>
        <Image source={require('../../assets/logo.png')} style={styles.loginLogo} resizeMode="contain" />
        <Text style={styles.loginWelcomeTitle}>Fuvex Sales Pro </Text>
        <Text style={styles.loginWelcomeSubtitle}>Ingresa tus credenciales corporativas para continuar</Text>
      </View>

      <View style={styles.loginCard}>
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>USUARIO</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person" size={18} color={theme.blue} style={styles.inputIcon} />
            <TextInput
              style={styles.loginInput}
              placeholder="Ej: jperalta"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholderTextColor={isDark ? "#64748B" : "#A0AEC0"}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>CONTRASEÑA</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed" size={18} color={theme.blue} style={styles.inputIcon} />
            <TextInput
              style={styles.loginInput}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={isDark ? "#64748B" : "#A0AEC0"}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.loginBtnContent}>
              <Text style={styles.loginBtnText}>INICIAR SESIÓN</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.forgotBtn}>
          <Text style={styles.forgotText}>¿Olvidaste tu acceso?</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.loginFooterText}>Versión 2.1.0 • Bearlytics © 2026</Text>
    </View>
  );
};
