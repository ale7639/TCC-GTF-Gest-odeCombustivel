import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { MenuProvider } from './src/menu/MenuContext';
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

const Tab = createBottomTabNavigator();

// Permite navegar de fora das telas (o menu lateral usa isso).
const navegacao = createNavigationContainerRef();

// Decide o que mostrar: carregando, login (sem sessão) ou o app com o menu lateral (com sessão).
function Rotas() {
  const { token, carregando } = useAuth();
  const [rotaAtual, setRotaAtual] = useState('Painel'); // para destacar a tela atual no menu

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!token) return <Login />;

  return (
    <NavigationContainer
      ref={navegacao}
      onStateChange={() => setRotaAtual(navegacao.getCurrentRoute()?.name ?? 'Painel')}
    >
      <MenuProvider>
        <View style={styles.raiz}>
          {/* As abas continuam existindo por baixo, mas a barra de baixo fica escondida: a navegação é pelo menu. */}
          <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
            <Tab.Screen name="Painel" component={Dashboard} />
            <Tab.Screen name="Frota" component={Caminhoes} />
            <Tab.Screen name="Motoristas" component={Motoristas} />
            <Tab.Screen name="Tanques" component={Tanques} />
            <Tab.Screen name="Abastecimentos" component={Abastecimentos} />
            <Tab.Screen name="RelatorioAbastecimentos" component={RelatorioAbastecimentos} />
            <Tab.Screen name="RelatorioMotoristas" component={RelatorioMotoristas} />
            <Tab.Screen name="LogAcesso" component={LogAcesso} />
          </Tab.Navigator>

          <MenuLateral navegacao={navegacao} rotaAtual={rotaAtual} />
        </View>
      </MenuProvider>
    </NavigationContainer>
  );
}

export default function App() {
  // No navegador, o app fica numa coluna centralizada (como num celular), em vez de esticar na tela toda.
  return (
    <View style={styles.pagina}>
      <View style={styles.app}>
        <AuthProvider>
          <Rotas />
        </AuthProvider>
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: '#d1d5db' },
  app: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    alignSelf: 'center',
    backgroundColor: '#f3f4f6',
  },
  raiz: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});