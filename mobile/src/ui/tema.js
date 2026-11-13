// Tokens compartilhados — marca vermelha, cartões suaves, hierarquia clara.
export const VERMELHO = '#dc2626';
export const VERMELHO_SUAVE = '#fef2f2';
export const CINZA_FUNDO = '#f3f4f6';
export const TEXTO = '#1f2937';
export const TEXTO_SUAVE = '#6b7280';
export const VERDE = '#16a34a';
export const BORDA = '#e5e7eb';

export const RAIO_CARTAO = 14;
export const RAIO_CAMPO = 10;
export const RAIO_BOTAO = 10;

export const sombraSuave = {
  shadowColor: '#000',
  shadowOpacity: 0.04,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
};

export const sombraMedia = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

export const cartaoBase = {
  backgroundColor: '#fff',
  borderRadius: RAIO_CARTAO,
  padding: 14,
  marginBottom: 8,
  ...sombraSuave,
};
