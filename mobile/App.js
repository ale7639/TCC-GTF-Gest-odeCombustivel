import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
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
import Aprovacoes from './src/screens/Aprovacoes';
import Servicos from './src/screens/Servicos';
import NotasFiscais from './src/screens/NotasFiscais';
import AreaMotorista from './src/screens/AreaMotorista';

const Tab = createBottomTabNavigator();

// Permite navegar de fora das telas (o menu lateral usa isso).
const navegacao = createNavigationContainerRef();

// Tela larga (computador): menu lateral sempre visível. Tela estreita (celular): menu escondido no botão ☰.
const LARGURA_MENU_FIXO = 900;

// Decide o que mostrar: carregando, login (sem sessão), área do motorista ou o sistema do admin.
function Rotas() {
  const { token, carregando, usuario } = useAuth();
  const [rotaAtual, setRotaAtual] = useState('Painel'); // para destacar a tela atual no menu
  const { width } = useWindowDimensions();
  const fixo = Platform.OS === 'web' && width >= LARGURA_MENU_FIXO;

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Login e área do motorista ficam numa coluna centralizada (formato de celular), mesmo no computador.
  if (!token) {
    return (
      <View style={styles.coluna}>
        <Login />
      </View>
    );
  }
  if (usuario?.perfil === 'motorista') {
    return (
      <View style={styles.coluna}>
        <AreaMotorista />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navegacao}
      onStateChange={() => setRotaAtual(navegacao.getCurrentRoute()?.name ?? 'Painel')}
    >
      <MenuProvider fixo={fixo}>
        <View style={[styles.raiz, fixo && { flexDirection: 'row' }]}>
          {fixo && <MenuLateral navegacao={navegacao} rotaAtual={rotaAtual} />}

          <View style={styles.conteudo}>
            {/* As abas existem por baixo, mas a barra de baixo fica escondida: a navegação é pelo menu.
                sceneStyle limita a largura do conteúdo para não esticar demais em monitores grandes. */}
            <Tab.Navigator
              sceneContainerStyle={styles.cena}
              screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' }, sceneStyle: styles.cena }}
            >
              <Tab.Screen name="Painel" component={Dashboard} />
              <Tab.Screen name="Frota" component={Caminhoes} />
              <Tab.Screen name="Motoristas" component={Motoristas} />
              <Tab.Screen name="Tanques" component={Tanques} />
              <Tab.Screen name="Abastecimentos" component={Abastecimentos} />
              <Tab.Screen name="Servicos" component={Servicos} />
              <Tab.Screen name="Aprovacoes" component={Aprovacoes} />
              <Tab.Screen name="RelatorioAbastecimentos" component={RelatorioAbastecimentos} />
              <Tab.Screen name="RelatorioMotoristas" component={RelatorioMotoristas} />
              <Tab.Screen name="NotasFiscais" component={NotasFiscais} />
              <Tab.Screen name="LogAcesso" component={LogAcesso} />
            </Tab.Navigator>
          </View>

          {!fixo && <MenuLateral navegacao={navegacao} rotaAtual={rotaAtual} />}
        </View>
      </MenuProvider>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <View style={styles.pagina}>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: '#f3f4f6' },
  coluna: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  raiz: { flex: 1 },
  conteudo: { flex: 1 },
  cena: { flex: 1, width: '100%', maxWidth: 1200, alignSelf: 'center', backgroundColor: '#f3f4f6' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});