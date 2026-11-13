import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { MenuProvider, useMenu } from './src/menu/MenuContext';
import MenuLateral from './src/menu/MenuLateral';
import Login from './src/screens/Login';
import Dashboard from './src/screens/Dashboard';
import Caminhoes from './src/screens/Caminhoes';
import Motoristas from './src/screens/Motoristas';
import Abastecimentos from './src/screens/Abastecimentos';
import Tanques from './src/screens/Tanques';
import RelatorioAbastecimentos from './src/screens/RelatorioAbastecimentos';
import RelatorioMotoristas from './src/screens/RelatorioMotoristas';
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
const navegacao = createNavigationContainerRef();
const LARGURA_TELEFONE = 430;
const VERMELHO = '#dc2626';

// NAV ABAS — visíveis na barra; o resto fica no menu ☰ / Mais.
const ABAS_VISIVEIS = new Set(['Painel', 'Frota', 'Abastecimentos', 'RelatorioAbastecimentos', 'Mais']);
const ABAS_MOTORISTA = new Set(['InicioMotorista', 'LancamentosMotorista', 'PerfilMotorista']);

const ICONES_ABA = {
  Painel: ['view-dashboard', 'view-dashboard-outline'],
  Frota: ['truck', 'truck-outline'],
  Abastecimentos: ['gas-station', 'gas-station-outline'],
  RelatorioAbastecimentos: ['chart-box', 'chart-box-outline'],
  Mais: ['dots-horizontal', 'dots-horizontal'],
  InicioMotorista: ['home', 'home-outline'],
  LancamentosMotorista: ['clipboard-list', 'clipboard-list-outline'],
  PerfilMotorista: ['account', 'account-outline']};

function MaisPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: '#f3f4f6' }} />;
}

function BarraItens({ state, navigation, nomesVisiveis, aoMais }) {
  const rotasVisiveis = state.routes.filter((r) => nomesVisiveis.has(r.name));

  return (
    <View style={styles.tabBar}>
      {rotasVisiveis.map((route) => {
        const focused =
          route.name === 'Mais'
            ? false
            : state.routes[state.index]?.name === route.name;
        const [iconeAtivo, iconeInativo] = ICONES_ABA[route.name] || ['circle', 'circle-outline'];
        const rotulo =
          route.name === 'RelatorioAbastecimentos'
            ? 'Relatórios'
            : route.name === 'Abastecimentos'
              ? 'Abastecer'
              : route.name === 'Mais'
                ? 'Mais'
                : route.name === 'InicioMotorista'
                  ? 'Início'
                  : route.name === 'LancamentosMotorista'
                    ? 'Lançamentos'
                    : route.name === 'PerfilMotorista'
                      ? 'Perfil'
                      : route.name;

        return (
          <Pressable
            key={route.name}
            onPress={() => {
              if (route.name === 'Mais' && aoMais) {
                aoMais();
                return;
              }
              navigation.navigate(route.name);
            }}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={rotulo}
          >
            <MaterialCommunityIcons
              name={focused ? iconeAtivo : iconeInativo}
              size={24}
              color={focused ? VERMELHO : '#6b7280'}
            />
            <Text style={[styles.tabLabel, focused && styles.tabLabelAtivo]}>{rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function BarraInferiorAdmin(props) {
  const { abrir } = useMenu();
  return <BarraItens {...props} nomesVisiveis={ABAS_VISIVEIS} aoMais={abrir} />;
}

function BarraInferiorMotorista(props) {
  return <BarraItens {...props} nomesVisiveis={ABAS_MOTORISTA} />;
}

// NAV ROTAS — login, abas do admin ou área do motorista.
function Rotas() {
  const { token, carregando, usuario } = useAuth();
  const [rotaAtual, setRotaAtual] = useState('Painel');
  const fixo = false;

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={VERMELHO} />
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.coluna}>
        <Login />
      </View>
    );
  }
  if (usuario?.perfil === 'motorista') {
    return (
      <NavigationContainer>
        <View style={styles.coluna}>
          <Tab.Navigator
            tabBar={(props) => <BarraInferiorMotorista {...props} />}
            sceneContainerStyle={styles.cena}
            screenOptions={{ headerShown: false, sceneStyle: styles.cena }}
          >
            <Tab.Screen name="InicioMotorista" component={AreaMotorista} />
            <Tab.Screen name="LancamentosMotorista" component={MeusLancamentos} />
            <Tab.Screen name="PerfilMotorista" component={PerfilMotorista} />
          </Tab.Navigator>
        </View>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer
      ref={navegacao}
      onStateChange={() => setRotaAtual(navegacao.getCurrentRoute()?.name ?? 'Painel')}
    >
      <MenuProvider fixo={fixo}>
        <View style={styles.raiz}>
          <View style={styles.conteudo}>
            <Tab.Navigator
              tabBar={(props) => <BarraInferiorAdmin {...props} />}
              sceneContainerStyle={styles.cena}
              screenOptions={{ headerShown: false, sceneStyle: styles.cena }}
            >
              <Tab.Screen name="Painel" component={Dashboard} />
              <Tab.Screen name="Frota" component={Caminhoes} />
              <Tab.Screen name="Abastecimentos" component={Abastecimentos} />
              <Tab.Screen name="RelatorioAbastecimentos" component={RelatorioAbastecimentos} />
              <Tab.Screen name="Mais" component={MaisPlaceholder} listeners={{ tabPress: (e) => e.preventDefault() }} />
              <Tab.Screen name="Motoristas" component={Motoristas} options={{ tabBarButton: () => null }} />
              <Tab.Screen name="Tanques" component={Tanques} options={{ tabBarButton: () => null }} />
              <Tab.Screen name="Servicos" component={Servicos} options={{ tabBarButton: () => null }} />
              <Tab.Screen name="Aprovacoes" component={Aprovacoes} options={{ tabBarButton: () => null }} />
              <Tab.Screen name="RelatorioMotoristas" component={RelatorioMotoristas} options={{ tabBarButton: () => null }} />
              <Tab.Screen name="NotasFiscais" component={NotasFiscais} options={{ tabBarButton: () => null }} />
              <Tab.Screen name="LogAcesso" component={LogAcesso} options={{ tabBarButton: () => null }} />
            </Tab.Navigator>
          </View>

          <MenuLateral navegacao={navegacao} rotaAtual={rotaAtual} />
        </View>
      </MenuProvider>
    </NavigationContainer>
  );
}

function Shell({ children }) {
  if (Platform.OS !== 'web') {
    return <View style={styles.telefoneNativo}>{children}</View>;
  }
  return <View style={styles.telefoneWeb}>{children}</View>;
}

// APP
export default function App() {
  useEffect(() => {
    setupWeb();
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.pagina}>
        <Shell>
          <AuthProvider>
            <ToastProvider>
              <Rotas />
            </ToastProvider>
          </AuthProvider>
        </Shell>
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  pagina: {
    flex: 1,
    width: '100%',
    backgroundColor: Platform.OS === 'web' ? '#6b7280' : '#f3f4f6',
    ...(Platform.OS === 'web'
      ? { alignItems: 'center', justifyContent: 'flex-start' }
      : null)},
  telefoneNativo: { flex: 1, width: '100%', backgroundColor: '#f3f4f6' },
  telefoneWeb: {
    flex: 1,
    width: '100%',
    maxWidth: LARGURA_TELEFONE,
    alignSelf: 'center',
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#374151',
    boxShadow: '0 12px 40px rgba(0,0,0,0.28)'},
  coluna: { flex: 1, width: '100%' },
  raiz: { flex: 1 },
  conteudo: { flex: 1 },
  cena: { flex: 1, width: '100%', backgroundColor: '#f3f4f6' },
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

