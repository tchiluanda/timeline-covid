library(tidyverse)
library(rvest)


#document.querySelector(':not(center) > table td:nth-child(2)').innerText

ementa <- read_html("http://www.planalto.gov.br/CCIVIL_03/_Ato2019-2022/2021/Mpv/mpv1037.htm")

ementa %>%
  html_element("html") 
