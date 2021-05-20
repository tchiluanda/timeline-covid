library(tidyverse)
library(extrafont)
library(lubridate)

loadfonts()

dados_raw <- read.csv('dados_painel_full.csv')

dados_raw$nome_do_gasto %>% unique()

dados_vis <- dados_raw %>%
  mutate(mes = lubridate::ymd(mes_lancamento)) %>%
  filter(fase_da_despesa == "Pagamento") %>%
  select(mes, nome_do_gasto, gasto_item) %>%
  spread(nome_do_gasto, gasto_item)

dvis2020 <- dados_vis %>% filter(year(mes) == 2020)

dez2020 <- dados_vis %>% filter(month(mes) == 12)

dvis2021 <- dados_vis %>% 
  filter(year(mes) == 2021) %>%
  mutate_if(is.numeric, ~replace_na(., 0))

for (coluna in 2:ncol(dvis2021)) {
  
  for (linha in 1:nrow(dvis2021)) {
    
    dvis2021[linha, coluna] <- dvis2021[linha,coluna] + dez2020[1, coluna]
    
  }
  
}

dvis <- bind_rows(dvis2020, dvis2021) %>%
  gather(-mes, key = nome_do_gasto, value = gasto_item) %>%
  mutate(destaque = nome_do_gasto == "Concessão de Financiamento para Pagamento de Folha Salarial")

dvis_mensal1 <- bind_rows(dvis2020, dvis2021) %>%
  mutate_if(is.numeric, ~replace_na(., 0))

dvis_mensal3 <- bind_rows(dvis2020, dvis2021) %>%
  mutate_if(is.numeric, ~replace_na(., 0)) %>%
  mutate_if(is.numeric, ~ . -lag(.)) %>%
  gather(-mes, key = nome_do_gasto, value = gasto_item)


ggplot(dvis, aes(x = mes, y = gasto_item, fill = nome_do_gasto)) +
  geom_col() +
  scale_y_continuous(labels = function(x) format(x/1e9, big.mark = ".", decimal.mark = ","))

ggplot(dvis, aes(
  x = mes, y = gasto_item, group = nome_do_gasto, 
  color = nome_do_gasto == "Concessão de Financiamento para Pagamento de Folha Salarial")) +
  geom_line() +
  scale_y_continuous(
    labels = function(x) format(x/1e9, big.mark = ".", decimal.mark = ","),
    limits = c(0,100e9)) + 
  labs(color = NULL, title = 'Concessão de Financiamento para Pagamento de Folha Salarial') +
  scale_color_manual(values = c('TRUE' = 'hotpink', 'FALSE' = 'grey' )) +
  theme(legend.position = 'none',
        text = element_text(family = 'Lato', size = 10))


ggplot(dvis_mensal3, aes(x = mes, y = gasto_item, fill = nome_do_gasto)) +
  geom_col() +
  scale_y_continuous(labels = function(x) format(x/1e9, big.mark = ".", decimal.mark = ",")) +
  coord_flip()
