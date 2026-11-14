// Cores do sistema, todas num lugar só. Para mudar a cara do app, mude aqui.
//
// Regras da paleta (vermelho e branco):
//  - primaria (vermelho): botões, destaques e o que pede atenção (pendente, nível baixo, manutenção);
//  - perigo (vermelho escuro): erros, excluir, recusar, sair;
//  - branco e cinzas: fundo, cartões, textos e bordas (aprovado/ativo/sucesso ficam neutros);
//  - exceções em verde: o botão do WhatsApp (a cor que o usuário reconhece)
//    e o status "Ativo" do caminhão (pronto para rodar).
export const cores = {
  primaria: '#e53935',
  primariaClara: '#fdecea',  // fundo vermelho bem claro (avisos, pré-visualizações)
  primariaEscura: '#b71c1c', // texto sobre o fundo vermelho claro
  perigo: '#b71c1c',

  fundo: '#f3f4f6',          // fundo das telas
  fundoExterno: '#c9ced6',   // fundo do navegador, fora da "tela de celular"
  cartao: '#fff',

  texto: '#111827',          // títulos e valores
  textoMedio: '#374151',     // rótulos
  textoSecundario: '#6b7280',// detalhes
  textoClaro: '#9ca3af',     // itens inativos

  borda: '#d1d5db',
  bordaClara: '#e5e7eb',

  whatsapp: '#16a34a',       // exceção: só no botão do WhatsApp
  ativo: '#16a34a',          // exceção: caminhão ativo (na etiqueta vira fundo verde claro)
};

// Largura da "tela de celular" quando o sistema abre no computador.
export const LARGURA_CELULAR = 430;