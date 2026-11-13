import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMenu } from './MenuContext';
import { cores } from '../ui/tema';

// Atalhos da barra de baixo. "Mais" abre o menu completo (☰).
// "ativas" = telas em que o atalho fica destacado.
const ATALHOS = [
  { rotulo: 'Painel', icone: 'view-dashboard-outline', rota: 'Painel', ativas: ['Painel'] },
  { rotulo: 'Frota', icone: 'truck-outline', rota: 'Frota', ativas: ['Frota'] },
  { rotulo: 'Abastecer', icone: 'gas-station-outline', rota: 'Abastecimentos', ativas: ['Abastecimentos'] },
  {
    rotulo: 'Relatórios',
    icone: 'chart-box-outline',
    rota: 'RelatorioAbastecimentos',
    ativas: ['RelatorioAbastecimentos', 'RelatorioMotoristas', 'NotasFiscais'],
  },
  { rotulo: 'Mais', icone: 'dots-horizontal', rota: null, ativas: [] },
];

export default function BarraInferior({ navegacao, rotaAtual }) {
  const { abrir } = useMenu();

  const tocar = (atalho) => {
    if (!atalho.rota) return abrir();
    if (navegacao.isReady()) navegacao.navigate(atalho.rota);
  };

  return (
    <View style={styles.barra}>
      {ATALHOS.map((a) => {
        const ativo = a.ativas.includes(rotaAtual);
        const cor = ativo ? cores.primaria : cores.textoClaro;
        return (
          <Pressable key={a.rotulo} style={styles.item} onPress={() => tocar(a)}>
            <MaterialCommunityIcons name={a.icone} size={24} color={cor} />
            <Text style={[styles.rotulo, { color: cor }, ativo && styles.rotuloAtivo]}>{a.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    paddingVertical: 6,
  },
  item: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  rotulo: { fontSize: 11, marginTop: 2 },
  rotuloAtivo: { fontWeight: '700' },
});