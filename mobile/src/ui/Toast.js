import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TEXTO, VERDE, VERMELHO } from './tema';

const ToastContext = createContext(null);

const ICONES = {
  sucesso: { nome: 'check-circle', cor: VERDE },
  erro: { nome: 'alert-circle', cor: VERMELHO },
  info: { nome: 'information', cor: '#2563eb' },
};

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const esconder = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setToast(null);
    });
  }, [opacity]);

  const mostrar = useCallback(
    (mensagem, tipo = 'sucesso', ms = 2600) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ mensagem, tipo });
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      timer.current = setTimeout(esconder, ms);
    },
    [esconder, opacity]
  );

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const api = useMemo(
    () => ({
      sucesso: (mensagem) => mostrar(mensagem, 'sucesso'),
      erro: (mensagem) => mostrar(mensagem, 'erro', 3400),
      info: (mensagem) => mostrar(mensagem, 'info'),
    }),
    [mostrar]
  );

  const icone = toast ? ICONES[toast.tipo] || ICONES.info : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { opacity }]}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.caixa}>
            {icone && (
              <MaterialCommunityIcons name={icone.nome} size={20} color={icone.cor} style={styles.icone} />
            )}
            <Text style={styles.texto}>{toast.mensagem}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      sucesso: () => {},
      erro: () => {},
      info: () => {},
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'web' ? 78 : 88,
    alignItems: 'center',
    zIndex: 9999,
  },
  caixa: {
    maxWidth: 420,
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  icone: { marginRight: 10 },
  texto: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
