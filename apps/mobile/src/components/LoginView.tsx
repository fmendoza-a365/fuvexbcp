import React, { useState } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, useColorScheme, KeyboardAvoidingView, Platform, ScrollView, Animated } from 'react-native';
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
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  return (
    <View style={styles.loginContainer}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* Decorative Elements */}
      <View style={styles.loginHeaderDecorator} />
      <View style={styles.loginFooterDecorator} />
      <View style={{
        position: 'absolute',
        top: '30%',
        right: -40,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(0, 42, 141, 0.03)',
      }} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, width: '100%', justifyContent: 'center' }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <View style={styles.loginHeader}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 28,
              backgroundColor: theme.blue,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              shadowColor: theme.blue,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            }}>
              <Image source={require('../../assets/logo.png')} style={{ width: 50, height: 25, tintColor: '#fff' }} resizeMode="contain" />
            </View>
            <Text style={styles.loginWelcomeTitle}>Fuvex Sales Pro</Text>
            <Text style={styles.loginWelcomeSubtitle}>Ingresa tus credenciales corporativas para continuar</Text>
          </View>

          {/* Login Card */}
          <View style={styles.loginCard}>
            {/* Username Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>USUARIO</Text>
              <View style={[
                styles.inputWrapper,
                focusedField === 'username' && {
                  borderColor: theme.blue,
                  borderWidth: 2,
                  backgroundColor: isDark ? '#1a1a2e' : '#F0F4FF',
                }
              ]}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: focusedField === 'username' 
                    ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#EEF2FF')
                    : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9'),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons 
                    name="person" 
                    size={18} 
                    color={focusedField === 'username' ? theme.blue : theme.subtext} 
                  />
                </View>
                <TextInput
                  style={[styles.loginInput, { fontSize: 15 }]}
                  placeholder="Ej: jperalta"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>CONTRASEÑA</Text>
              <View style={[
                styles.inputWrapper,
                focusedField === 'password' && {
                  borderColor: theme.blue,
                  borderWidth: 2,
                  backgroundColor: isDark ? '#1a1a2e' : '#F0F4FF',
                }
              ]}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: focusedField === 'password' 
                    ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#EEF2FF')
                    : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9'),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons 
                    name="lock-closed" 
                    size={18} 
                    color={focusedField === 'password' ? theme.blue : theme.subtext} 
                  />
                </View>
                <TextInput
                  style={[styles.loginInput, { fontSize: 15 }]}
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={{ padding: 8 }}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color={theme.subtext} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity 
              style={[styles.loginBtn, loading && { opacity: 0.7 }]} 
              onPress={handleLogin} 
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.loginBtnContent}>
                  <Text style={styles.loginBtnText}>INICIAR SESIÓN</Text>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              marginVertical: 20,
              paddingHorizontal: 10,
            }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
              <Text style={{ 
                marginHorizontal: 15, 
                fontSize: 10, 
                fontWeight: '800', 
                color: theme.subtext,
                letterSpacing: 1,
              }}>BCP SEGURO</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            </View>

            {/* Security Badge */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#BBF7D0',
            }}>
              <Ionicons name="shield-checkmark" size={18} color={theme.emerald} style={{ marginRight: 10 }} />
              <Text style={{ 
                fontSize: 11, 
                fontWeight: '700', 
                color: theme.emerald,
                letterSpacing: 0.5,
              }}>Conexión cifrada y segura</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={{ alignItems: 'center', marginTop: 30 }}>
            <Text style={styles.loginFooterText}>Versión 2.1.0 • Bearlytics © 2026</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};