library(tidyverse)
library(extrafont)
library(lubridate)
library(patchwork)
library(RColorBrewer)
library(readxl)


loadfonts()

dados_raw <- read.csv('dados_timeline_rtn2.csv')

dados_detalhados_instrumentos <- read_excel('dados_instrumentos.xlsx')

dados_instrumentos <- dados_raw %>%
  group_by(agrupamento, instrumento_inicial) %>%
  summarise_at(vars(data, encerramento), ~first(.)) %>%
  ungroup() %>%
  filter(!is.na(agrupamento)) %>%
  mutate(data = as_date(data),
         encerramento = as_date(encerramento)) %>%
  mutate(encerramento = replace_na(encerramento, lubridate::today()))

dados_instrumentos_finais <- dados_raw %>%
  filter(!is.na(instrumento_final)) %>%
  group_by(agrupamento, instrumento_final) %>%
  summarise_at(vars(data, encerramento), ~first(.)) %>%
  ungroup() %>%
  filter(!is.na(agrupamento)) %>%
  mutate(data = as_date(data),
         encerramento = as_date(encerramento)) %>%
  mutate(encerramento = replace_na(encerramento, lubridate::today()))


ggplot(dados_instrumentos, aes(x = agrupamento, xend = agrupamento, y = data, yend = encerramento)) + 
  geom_segment() +
  geom_point() +
  geom_text(aes(label = instrumento_inicial), hjust = 'left', size = 2) 

ggplot(dados_instrumentos, 
       aes(
         y = reorder(instrumento_inicial, data),
         yend = instrumento_inicial, 
         x = data, 
         xend = encerramento,
         color = agrupamento)) + 
  geom_segment() +
  geom_point()

sum_dados_instrumentos <- data.frame(
  agrupamento = unique(dados_instrumentos$agrupamento),
  data_inicial = rep(min(dados_instrumentos$data), length(unique(dados_instrumentos$agrupamento))),
  data_final = rep(max(dados_instrumentos$encerramento), length(unique(dados_instrumentos$agrupamento)))
)

instrumentos_multiplos <- dados_instrumentos %>% 
  count(instrumento_inicial) %>%
  filter(n > 1) %>%
  left_join(dados_instrumentos)

cores <- brewer.pal(6, 'Accent')
names(cores) <- c("Medidas Federativas", "Medidas Sanitárias", "Outras Medidas", 
                  "Proteção Social", "sem grupo", "Suporte ao Trabalho")


metro <- ggplot() +
  geom_path(data = instrumentos_multiplos, aes(x = data, y = agrupamento, group = instrumento_inicial)) +
  geom_segment(data = sum_dados_instrumentos, 
            aes(y = agrupamento, yend = agrupamento, x = data_inicial, xend = data_final, color = agrupamento), size = 2) +
  geom_point(data = dados_instrumentos, aes(y = agrupamento, x = data), color = 'black') +
  scale_color_manual(values = cores) + 
  theme(legend.position = 'none')

# agrupamentos <- dados_raw %>%
#   distinct(agrupamento, nome_do_gasto)
# desps <- read.csv('dados_painel_full.csv')



gastos <- dados_raw %>%
  filter(fase_da_despesa == "Pagamento") %>%   #, !is.na(agrupamento)) %>%
  mutate(mes_lancamento = as_date(mes_lancamento),
         agrupamento = replace_na(agrupamento, 'sem grupo')) %>%
  group_by(agrupamento, mes_lancamento, nome_do_gasto, instrumento_inicial) %>%
  summarise(gasto = first(gasto_item)) %>%
  ungroup() %>%
  group_by(agrupamento, mes_lancamento) %>%
  summarise(gasto = sum(gasto)) %>%
  as.data.frame()

gastos_finais_2020 <- gastos %>% filter(mes_lancamento == '2020-12-01') %>% as.data.frame()
# se não transformar os dois em data frame, dá erro :/

gastos_filled <- gastos %>% 
  spread(agrupamento, value = gasto, fill = 0) %>% 
  gather(-mes_lancamento, key = agrupamento, value = gasto)

gastos_copia <- gastos_filled

for (linha in 1:nrow(gastos_filled)) {
  
  data_corte <- as_date('2021-01-01')
  
  if (gastos_filled[linha, 'mes_lancamento'] >= data_corte) {
    
    print(paste(
      gastos_filled[linha, 'mes_lancamento'],
      gastos_filled[linha, 'agrupamento'],
      which(gastos_finais_2020$agrupamento == gastos_filled[linha, 'agrupamento']),
      linha,
      gastos_filled[linha, 'gasto'],
      gastos_copia[linha, 'gasto'],
      sep = '|'
    ))
    
    agrupamento <- gastos_filled[linha, 'agrupamento']
    linha_agrupamento <- which(gastos_finais_2020$agrupamento == agrupamento)
    
    gastos_copia[linha, 'gasto'] <- gastos_filled[linha, 'gasto'] + 
      gastos_finais_2020[linha_agrupamento, 'gasto']
    
  }
  
}

gastos_plot <- ggplot(gastos_copia, 
                      aes(x = mes_lancamento, y = gasto, fill = agrupamento)) + 
  geom_col() +
  scale_x_date(
    date_labels = "%b %Y",
    limits = c(sum_dados_instrumentos$data_inicial[1], sum_dados_instrumentos$data_final[1])) +
  scale_fill_manual(values = cores) +
  labs(x = NULL)


gastos_plot / metro + plot_layout(heights = c(4,1))

g <- gastos_plot + coord_flip()
m <- metro + coord_flip() + theme(legend.position = 'none')

m + g + plot_layout(widths = c(1,4))


# gastos mensais ----------------------------------------------------------

gastos_mensais <- gastos_copia %>%
  group_by(agrupamento) %>%
  mutate(gasto = ifelse(
    row_number()>1,
    gasto - lag(gasto),
    gasto))

# cirurgia

posicoes_neg <- which(gastos_mensais$gasto < 0)

for (posicao in posicoes_neg) {
  
  valor_neg <- gastos_mensais[posicoes_neg,"gasto"]
  gastos_mensais[posicoes_neg, "gasto"] <- 0
  gastos_mensais[posicoes_neg-1, "gasto"] <- gastos_mensais[posicoes_neg-1, "gasto"] + valor_neg
  
}

ggplot(gastos_mensais, 
       aes(x = mes_lancamento, y = gasto, fill = agrupamento)) + 
  geom_col() +
  scale_x_date(
    date_labels = "%b %Y",
    limits = c(sum_dados_instrumentos$data_inicial[1], sum_dados_instrumentos$data_final[1])) +
  scale_fill_manual(values = cores) +
  labs(x = NULL)

# export ------------------------------------------------------------------



gastos_export <- gastos_copia %>% 
  spread(agrupamento, gasto, fill = 0)

write.csv(gastos_export, '../gastos.csv')

gastos_mensais_export <- gastos_mensais %>% 
  spread(agrupamento, gasto, fill = 0)

write.csv(gastos_mensais_export, '../gastos_mensais.csv')

sum_dados_instrumentos$data_final <- max(gastos_copia$mes_lancamento)

output <- list(
  multiplos = instrumentos_multiplos,
  pontos = dados_detalhados_instrumentos,
  extremos = sum_dados_instrumentos
)

jsonlite::write_json(output, '../metro.json')
