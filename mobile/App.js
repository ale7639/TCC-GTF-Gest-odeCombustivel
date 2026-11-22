import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { MenuProvider, useMenu } from './src/menu/MenuContext';
import MenuLateral from './src/menu/MenuLateral';
import BarraInferior from './src/menu/BarraInferior';
import Moldura from './src/ui/Moldura';
import Login from './src/screens/Login';
import Dashboard from './src/screens/Dashboard';
import Caminhoes from './src/screens/Caminhoes';
import Motoristas from './src/screens/Motoristas';
import Abastecimentos from './src/screens/Abastecimentos';
import Tanques from './src/screens/Tanques';
import RelatorioAbastecimentos from './src/screens/RelatorioAbastecimentos';
import RelatorioMotoristas from './src/screens/RelatorioMotoristas';
import RelatorioCaminhoes from './src/screens/RelatorioCaminhoes';
import LogAcesso from './src/screens/LogAcesso';
import Aprovacoes from './src/screens/Aprovacoes';
import Servicos from './src/screens/Servicos';
import NotasFiscais from './src/screens/NotasFiscais';
import AreaMotorista from './src/screens/AreaMotorista';
import MeusLancamentos from './src/screens/MeusLancamentos';
import PerfilMotorista from './src/screens/PerfilMotorista';
import { ToastProvider } from './src/ui/Toast';
import { setupWeb } from './src/webSetup';

// NAV / APP — shell do Expo: auth → abas admin ou motorista.

const Tab = createBottomTabNavigator();

// Permite navegar de fora das telas (o menu lateral e a barra de baixo usam isso).
const navegacao = createNavigationContainerRef();
const LARGURA_TELEFONE = 430;
const VERMELHO = '#dc2626';

// Decide o que mostrar: carregando, login (sem sessão), área do motorista ou o sistema do admin.
function Rotas() {
  const { token, carregando, usuario } = useAuth();
  const [rotaAtual, setRotaAtual] = useState('Painel'); // para destacar a tela atual no menu e na barra

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={VERMELHO} />
      </View>
    );
  }

  if (!token) return <Login />;

  // Motorista vê só a própria área (sem menu de gestão).
  if (usuario?.perfil === 'motorista') return <AreaMotorista />;

  return (
    <NavigationContainer
      ref={navegacao}
      onStateChange={() => setRotaAtual(navegacao.getCurrentRoute()?.name ?? 'Painel')}
    >
      <MenuProvider>
        <View style={styles.raiz}>
          {/* A barra de abas do React Navigation fica escondida: no lugar dela usamos a BarraInferior. */}
          <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
            <Tab.Screen name="Painel" component={Dashboard} />
            <Tab.Screen name="Frota" component={Caminhoes} />
            <Tab.Screen name="Motoristas" component={Motoristas} />
            <Tab.Screen name="Tanques" component={Tanques} />
            <Tab.Screen name="Abastecimentos" component={Abastecimentos} />
            <Tab.Screen name="Servicos" component={Servicos} />
            <Tab.Screen name="Aprovacoes" component={Aprovacoes} />
            <Tab.Screen name="RelatorioAbastecimentos" component={RelatorioAbastecimentos} />
            <Tab.Screen name="RelatorioMotoristas" component={RelatorioMotoristas} />
            <Tab.Screen name="RelatorioCaminhoes" component={RelatorioCaminhoes} />
            <Tab.Screen name="NotasFiscais" component={NotasFiscais} />
            <Tab.Screen name="LogAcesso" component={LogAcesso} />
          </Tab.Navigator>

          <BarraInferior navegacao={navegacao} rotaAtual={rotaAtual} />

          {/* O menu ☰ fica por último para abrir por cima de tudo (inclusive da barra de baixo). */}
          <MenuLateral navegacao={navegacao} rotaAtual={rotaAtual} />
        </View>
      </MenuProvider>
    </NavigationContainer>
  );
}

// O sistema inteiro aparece no formato de celular, centralizado no monitor.
export default function App() {
  useEffect(() => {
    setupWeb();
  }, []);

  return (
    <Moldura>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
      <StatusBar style="light" />
    </Moldura>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 18 : 8,
    minHeight: 58},
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48},
  tabLabel: { fontSize: 11, fontWeight: '500', color: '#6b7280' },
  tabLabelAtivo: { color: VERMELHO, fontWeight: '700' }});

