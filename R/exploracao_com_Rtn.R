library(tidyverse)
library(extrafont)
library(lubridate)

loadfonts()

dados_raw <- read.csv('dados_timeline_rtn.csv')

dados_instrumentos <- dados_raw %>%
  group_by(agrupamento, instrumento_inicial) %>%
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



metro <- ggplot() +
  geom_path(data = instrumentos_multiplos, aes(x = data, y = agrupamento, group = instrumento_inicial)) +
  geom_segment(data = sum_dados_instrumentos, 
            aes(y = agrupamento, yend = agrupamento, x = data_inicial, xend = data_final, color = agrupamento), size = 2) +
  geom_point(data = dados_instrumentos, aes(y = agrupamento, x = data), color = 'black')


agrupamentos <- dados_raw %>%
  distinct(agrupamento, nome_do_gasto)
desps <- read.csv('dados_painel_full.csv')



gastos <- dados_raw %>%
  filter(fase_da_despesa == "Pagamento", !is.na(agrupamento)) %>%
  mutate(mes_lancamento = as_date(mes_lancamento)) %>%
  group_by(agrupamento, mes_lancamento, nome_do_gasto, instrumento_inicial) %>%
  summarise(gasto = first(gasto_item)) %>%
  ungroup() %>%
  group_by(agrupamento, mes_lancamento) %>%
  summarise(gasto = sum(gasto))

gastos_plot <- ggplot(gastos, 
                      aes(x = mes_lancamento, y = gasto, fill = agrupamento)) + 
  geom_col() +
  scale_x_date(limits = c(sum_dados_instrumentos$data_inicial[1], sum_dados_instrumentos$data_final[1]))

library(patchwork)

gastos_plo/ metro + plot_layout(heights = c(4,1))
