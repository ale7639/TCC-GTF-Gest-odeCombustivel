import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { useMenu } from './MenuContext';

const LARGURA = 280;

// Telas que aparecem no menu. Para adicionar uma tela nova, acrescente uma linha aqui
// (e a tela correspondente no App.js, com o mesmo nome em "rota").
const ITENS = [
  { rota: 'Painel', rotulo: 'Painel', icone: 'view-dashboard-outline' },
  { secao: 'Gestão' },
  { rota: 'Frota', rotulo: 'Gestão de frota', icone: 'truck-outline' },
  { rota: 'Motoristas', rotulo: 'Gestão de motoristas', icone: 'account-group-outline' },
  { rota: 'Tanques', rotulo: 'Gestão de tanques', icone: 'water-outline' },
  { rota: 'Abastecimentos', rotulo: 'Abastecimentos', icone: 'gas-station-outline' },
  { secao: 'Relatórios' },
  { rota: 'RelatorioAbastecimentos', rotulo: 'Abastecimentos', icone: 'chart-box-outline' },
  { rota: 'RelatorioMotoristas', rotulo: 'Motoristas', icone: 'account-details-outline' },
  { secao: 'Segurança' },
  { rota: 'LogAcesso', rotulo: 'Log de acesso', icone: 'shield-account-outline' },
];

// Menu que desliza da esquerda, aberto pelo botão de três risquinhos de cada tela.
export default function MenuLateral({ navegacao, rotaAtual }) {
  const { aberto, fechar } = useMenu();
  const { usuario, sair } = useAuth();
  const progresso = useRef(new Animated.Value(0)).current; // 0 = fechado, 1 = aberto
  const [montado, setMontado] = useState(false);            // mantém o menu na tela durante a animação de fechar

  useEffect(() => {
    const nativo = Platform.OS !== 'web';
    if (aberto) {
      setMontado(true);
      Animated.timing(progresso, { toValue: 1, duration: 200, useNativeDriver: nativo }).start();
    } else {
      Animated.timing(progresso, { toValue: 0, duration: 150, useNativeDriver: nativo }).start(() =>
        setMontado(false)
      );
    }
  }, [aberto, progresso]);

  if (!montado) return null;

  const irPara = (rota) => {
    if (navegacao.isReady()) navegacao.navigate(rota);
    fechar();
  };

  const aoSair = () => {
    fechar();
    sair();
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Fundo escurecido: tocar nele fecha o menu */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.fundo, { opacity: progresso }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={fechar} />
      </Animated.View>

      <Animated.View
        style={[
          styles.painel,
          { transform: [{ translateX: progresso.interpolate({ inputRange: [0, 1], outputRange: [-LARGURA, 0] }) }] },
        ]}
      >
        <View style={styles.topo}>
          <Text style={styles.marca}>GESTÃO DE FROTA</Text>
          {usuario && (
            <>
              <Text style={styles.usuario}>{usuario.nome}</Text>
              <Text style={styles.email}>{usuario.email}</Text>
            </>
          )}
        </View>

        <ScrollView style={styles.itens}>
          {ITENS.map((item) => {
            // Título de grupo (não é clicável).
            if (item.secao) {
              return (
                <Text key={item.secao} style={styles.secao}>
                  {item.secao}
                </Text>
              );
            }

            const ativo = rotaAtual === item.rota;
            return (
              <Pressable
                key={item.rota}
                onPress={() => irPara(item.rota)}
                style={[styles.item, ativo && styles.itemAtivo]}
              >
                <MaterialCommunityIcons
                  name={item.icone}
                  size={22}
                  color={ativo ? '#2563eb' : '#374151'}
                />
                <Text style={[styles.itemTexto, ativo && { color: '#2563eb' }]}>{item.rotulo}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable onPress={aoSair} style={styles.sair}>
          <MaterialCommunityIcons name="logout" size={22} color="#dc2626" />
          <Text style={styles.sairTexto}>Sair</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fundo: { backgroundColor: 'rgba(0,0,0,0.4)' },
  painel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: LARGURA,
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  topo: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  marca: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  usuario: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 10 },
  email: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  itens: { flex: 1, paddingTop: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  secao: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 2,
  },
  itemAtivo: { backgroundColor: '#eff6ff' },
  itemTexto: { fontSize: 16, fontWeight: '500', color: '#374151' },
  sair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  sairTexto: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
});