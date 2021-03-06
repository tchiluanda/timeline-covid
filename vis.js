const vis = {

    data : {

        raw : null,

        mensal : null,

        stacked : null,

        stacked_mensal : null,

        metro : null,

        totais : {},

        load : () => {

            Promise.all([

                d3.csv("./gastos.csv", d => {

                    const locale = vis.utils.localeDataBrasil;
                    d3.timeFormatDefaultLocale(locale);

                    d['date'] = d3.timeParse("%Y-%m-%d")(d.mes_lancamento);
                    d["data_br"] = d3.timeFormat("%B de %Y")(d.date);
    
                    return d
    
                }),

                d3.csv("./gastos_mensais.csv", d => {

                    d['date'] = d3.timeParse("%Y-%m-%d")(d.mes_lancamento);
                    d["data_br"] = d3.timeFormat("%B de %Y")(d.date);
    
                    return d
    
                }),

                fetch('./metro.json', {mode: 'cors'}).then( response => response.json())

            ])


              .then(function(dados) {

                vis.data.raw = dados[0];
                vis.data.mensal = dados[1]
                vis.data.metro = dados[2];

                vis.data.metro.multiplos.forEach(d => {

                    d['date'] = d3.timeParse("%Y-%m-%d")(d.data);

                });

                vis.data.metro.pontos.forEach(d => {

                    d['date'] = d3.timeParse("%Y-%m-%d")(d.data);

                });

                vis.data.metro.extremos.forEach(d => {

                    d['date_inicial'] = d3.timeParse("%Y-%m-%d")(d.data_inicial);
                    d['date_final'] = d3.timeParse("%Y-%m-%d")(d.data_final);

                });

                vis.data.metro['anotacoes'] = vis.data.metro.pontos.filter(d => d.anotacao_fixa);

                vis.ctrl.begin();


            })

        },

        make_stack : (data) => {

            const stacked = d3.stack()
             .keys(data.columns.slice(2))
             .offset(d3.stackOffsetSilhouette) //OffsetWiggle
             .order(d3.stackOrderNone)(data)  //.order(d3.stackOrderInsideOut)(data)

            return stacked;

        },

        calcula_totais : () => {

            const data = vis.data.raw.slice(-1)[0];

            console.log(data);

            vis.data.totais["repasses"] =  
              (+data['Medidas Sanit??rias'] / 1)
              + (+data['Prote????o Social'] / 1)
              + (+data['Suporte ao Trabalho'] / 1)
              + (+data['sem grupo'] / 1);

            vis.data.totais["renuncias"] = + data['Medidas Federativas'];

        }

    },

    svg_background : {

        ref : "#background",

        element : document.querySelector('#background'),

        height : null,
        width : null,

        get_document_size : function() {

            const main = document.querySelector('main');

            this.height = main.getBoundingClientRect().height * 1.05;
            this.width = main.getBoundingClientRect().width;

        },

        set_svg_size : function() {

            const svg = document.querySelector(this.ref);

            svg.style.height = this.height;

        }

    },

    line : {

        left_space : null,

        stroke : 10,

        x : null,

        y_final : null,

        get_left_space : function() {

            const el = document.querySelector('.margenzona');

            this.left_space = el.getBoundingClientRect().left;

            this.y_final = el.getBoundingClientRect().height;

        },

        draw : function() {

            let x = this.left_space <= 100 ? vis.svg_background.width / 3 : this.left_space / 2 - this.stroke / 2;

            x = x - this.stroke/2;

            this.x = x; // pq vou precisar mais na frente.
            
            console.log(x);

            d3.select("svg#background")
              .append('line')
              .classed('waiting', true)
              .attr('x1', x )
              .attr('x2', x )
              .attr('y1', 0)
              .attr('y2', vis.line.y_final + vis.metro.sizes.margins.top/2)//vis.svg_background.height)
              .attr('stroke-width', this.stroke);

        },

        expand : function() {

            d3.select("svg#background line").classed('waiting', false);

        }
        

    },

    stream : {

        refs : {

            svg: 'svg.stream',

            container : 'div.stream-wrapper'

        },

        sizes : {

            width: null,

            height: 2000,

            margins : {

                left: 50,
                right: 50,
                bottom: 60,
                top: 160

            },

            get : function() {

                const cont = document.querySelector(vis.stream.refs.container);

                this.width = +window.getComputedStyle(cont).getPropertyValue("width").slice(0,-2);

            },

            set : function() {

                const svg = document.querySelector(vis.stream.refs.svg);

                svg.style.height = this.height + 'px';

            }

        },

        scales : {

            x : null,

            y : null,

            color : null,

            set : function() {

                // y

                const data = vis.data.raw;
                const series = vis.data.stacked;

                const margin = vis.stream.sizes.margins;

                const sizes = vis.stream.sizes;

                this.y = d3.scaleTime()
                  .domain(
                    d3.extent(data, d => d.date))
                      //[vis.data.metro.extremos[0].date_inicial,
                      //vis.data.metro.extremos[1].date_final])
                  .range([margin.top, sizes.height - margin.bottom]);

                // x

                this.x = d3.scaleLinear()
                  .domain(
                      [
                          d3.min(series, d => d3.min(d, d => d[0])), 
                          d3.max(series, d => d3.max(d, d => d[1]))
                        ])
                  .range([margin.left, sizes.width - margin.right]);

                // color

                this.color = d3.scaleOrdinal()
                  .domain(data.columns.slice(2))
                  .range(d3.schemeCategory10);

            }

        },

        area : {
            
            generator : d3.area(),

            set : function() {

                const scales = vis.stream.scales;

                vis.stream.area.generator
                  .y(d => scales.y(d.data.date))
                  .x0(d => scales.x(d[0]))
                  .x1(d => scales.x(d[1]))
                  .curve(d3.curveCatmullRom);

            }

        },

        regua_legenda : {

            ref : '.regua-legenda',

            svg : 'svg.stream',

            init : function() {

                const svg = d3.select(vis.stream.regua_legenda.svg);

                const m = vis.stream.sizes.margins;

                svg
                  .append('line')
                  .classed('regua-legenda', true)
                  .classed('escondida', true)
                  .attr('y1', 0)
                  .attr('y2', 0)
                  .attr('x2', vis.stream.sizes.width - m.right)
                  .attr('x1', m.left + 10)
                ;

                const legenda_el = document.querySelector('.legenda-stream');

                legenda_el.style.left = (m.left + 10) + 'px';



            },

            update : function(date) {

                const y = vis.stream.scales.y;
                const pos_y = Math.round(y(date));

                const regua = d3.select(vis.stream.regua_legenda.ref);

                const legenda_el = document.querySelector('.legenda-stream');

                if (date) {

                    regua
                     .classed('escondida', false)
                     .attr('transform', `translate(0, ${pos_y})`);

                    legenda_el.classList.remove('escondida');
                    legenda_el.style.transform = `translate(0, calc(${pos_y}px - 50%))`;

                } else {

                    regua
                      .classed('escondida', true);

                    legenda_el.classList.add('escondida');

                }

                // update values

                if (date) {

                    const date_br = d3.timeFormat("%B de %Y")(date);

                    const tipo_valor = document.querySelector('#tipo-valor').value;
    
                    const data = tipo_valor == 'acumulado' ?
                      vis.data.raw :
                      vis.data.mensal; 
    
                    const mini_data = data.filter(d => d.data_br == date_br)[0];

                       // campos de valor
                    const campos = document.querySelectorAll('.legenda-stream [data-agrupamento]');
    
                    campos.forEach(campo => {
    
                        const agrupamento = campo.dataset.agrupamento;
    
                        const valor = mini_data[agrupamento]/1e9;
    
                        const campo_valor = campo.querySelector('.valor');
    
                        campo_valor.innerHTML = valor == 0 ? "0" : "R$ " + valor.toFixed(1) + "bi";
                        
    
                    })

                }

            },

            hide : function() {


            }

            // o listener est?? em vis.interacoes

        },

        axis : function() {

            const margin = vis.stream.sizes.margins;
            const width  = vis.stream.sizes.width;
            const y      = vis.stream.scales.y;
            const formataData = d3.timeFormat("%b/%Y");
            const svg    = d3.select(vis.stream.refs.svg);


            yAxis = function(g) {

                g
                  .call(d3.axisRight(y).tickFormat(d => formataData(d)))
                  //.attr("transform", `translate(${width - margin.right}, 0)`)

            }
              //.attr("transform", `translate(0,${height - margin.bottom})`)
              //.ticks(width / 80).tickSizeOuter(0))
              //.call(g => g.select(".domain").remove());

            svg.append("g")
              .classed('axis', true)
              .call(yAxis);
        },


        draw : function() {

            const svg = d3.select(vis.stream.refs.svg);
            const series = vis.data.stacked;
            const area = vis.stream.area.generator;
            const color = vis.stream.scales.color;

            svg.append("g")
              .selectAll("path")
              .data(series)
              .join("path")
              .classed('streamgraph', true)
              //.attr("fill", ({key}) => color(key))
              .attr('data-agrupamento', ({key}) => key)
              .attr("d", area)
              .append("title")
              .text(({key}) => key);
        
            //svg.append("g")
            //  .call(xAxis);


        },

        change : function(option) {

            const data = option == 'acumulado' ? 
                         vis.data.stacked :
                         vis.data.stacked_mensal;

            // update scales

            vis.stream.scales.x.domain(
                [
                    d3.min(data, d => d3.min(d, d => d[0])), 
                    d3.max(data, d => d3.max(d, d => d[1]))
                ]);
            
            // update area generator

            vis.stream.area.set();
        
            const area = vis.stream.area.generator;

            d3.selectAll('path.streamgraph')
              .data(data)
              .transition()
              .duration(1000)
              .attr('d', area);

            vis.stream.faz_eixo_x(option);

        },

        faz_eixo_x : function(mensal_ou_acumulado) {

            const dominio = vis.stream.scales.x.domain()[1] - vis.stream.scales.x.domain()[0];
            const range = vis.stream.scales.x.range()[1] - vis.stream.scales.x.range()[0];

            function scale_w(valor) {

                return valor * range / dominio;

            }

            console.log(dominio, range, scale_w(100e9));

            const divs = document.querySelectorAll('[data-eixo_x]');

            const breakpoints = mensal_ou_acumulado == "acumulado" 
            ? [500, 300, 100]
            : [100,  60,  20];

            breakpoints.forEach( (valor, i) => {

                divs[i].dataset.valor = `R$ ${valor}bi`;
                divs[i].style.width = scale_w(valor * 1e9) + 'px';

            })

        }

    },

    metro : {

        refs : {

            svg: 'svg.metro',

            container : 'div.metro-wrapper'

        },

        sizes : {

            width: null,

            height: null,

            margins : {

                left: 0,
                right: 10,
                bottom: 60,
                top: 160

            },

            get : function() {

                const cont = document.querySelector(vis.metro.refs.container);

                this.width = +window.getComputedStyle(cont).getPropertyValue("width").slice(0,-2);
                this.height = vis.stream.sizes.height;

            },

            set : function() {

                const svg = document.querySelector(vis.metro.refs.svg);

                svg.style.height = this.height + 'px';

            }

        },

        scales : {

            x : null, 

            y : null,

            color : null,

            set : function() {

                // y e color -- iguais aos do stream

                this.y     = vis.stream.scales.y;
                this.color = vis.stream.scales.color;

                // x

                const dominio = vis.data.metro.extremos.map(d => d.agrupamento);


                const largura_necessaria = dominio.length * 20;

                const width = vis.metro.sizes.width;

                const range = [

                    (width - largura_necessaria) / 2,
                    width - (width - largura_necessaria) / 2,

                ];

                const margin = vis.stream.sizes.margins;

                this.x = d3.scaleBand()
                  .domain(dominio)
                  .range(range);

            }

        },

        draw : {

            // lines : function() {

            //     const svg = d3.select(vis.metro.refs.svg);
            //     const data = vis.data.metro.extremos;
            //     const color = vis.metro.scales.color;
            //     const x = vis.metro.scales.x;
            //     const y = vis.metro.scales.y;
    
            //     svg
            //       .selectAll("line")
            //       .data(data)
            //       .join("line")
            //       .classed('metro-lines', true)
            //       .attr('data-agrupamento', d => d.agrupamento)
            //       .attr("stroke", d => color(d.agrupamento))
            //       .attr("x1", d => x(d.agrupamento))
            //       .attr("x2", d => x(d.agrupamento))
            //       .attr("y1", d => y(d.date_inicial))
            //       .attr("y2", d => y(d.date_final))
            //       .append("title")
            //       .text(({key}) => key);
                
            // },

            lines : function() {

                const svg = d3.select(vis.metro.refs.svg);
                const extremos = vis.data.metro.extremos;
                const color = vis.metro.scales.color;
                const margin = vis.metro.sizes.margins;
                const x = vis.metro.scales.x;
                const y = vis.metro.scales.y;

                const svg_el = document.querySelector(vis.metro.refs.svg);
                const svg_width = +window.getComputedStyle(svg_el).getPropertyValue('width').slice(0,-2)

                const data = {};

                extremos.forEach(linha => {

                    data[linha.agrupamento] = [

                        {
                            y : margin.top/2,
                            x : svg_width/2 - vis.line.stroke//vis.line.x - margin_left
                            // aqui t?? confiando no css, que calculou a largura do wrapper como sendo igual ?? margem esquerda do texto acima.
                        },

                        {

                            y : y(linha.date_inicial),
                            x : x(linha.agrupamento)

                        },

                        {

                            y : y(linha.date_final),
                            x : x(linha.agrupamento)
                        }

                    ];

                });

                console.log(data);

                const line_gen = d3.line()
                  .x(d => d.x)
                  .y(d => d.y)
                  .curve(d3.curveBumpY);

                extremos.forEach(serie => {

                    const agrupamento = serie.agrupamento;

                    svg
                      .append('path')
                      .datum(data[agrupamento])
                      .attr('d', line_gen)
                      .classed('metro-lines', true)
                      .attr('data-agrupamento', agrupamento);
                      //.attr('stroke', color(agrupamento));

                })

            },

            pontos : function() {

                const data = vis.data.metro.pontos;
                const svg = d3.select(vis.metro.refs.svg);
                const color = vis.metro.scales.color;
                const x = vis.metro.scales.x;
                const y = vis.metro.scales.y;

                svg
                  .selectAll('circle.metro-instrumentos')
                  .data(data)
                  .join('circle')
                  .classed('metro-instrumentos', true)
                  .attr('cx', d => x(d.agrupamento))
                  .attr('cy', d => y(d.date));
                  //.attr('fill', 'black')
                  //.append('title')
                  //  .text(d => d.instrumento);

            },

            connecting_lines : function() {

                const data = vis.data.metro.multiplos;
                const svg = d3.select(vis.metro.refs.svg);
                const color = vis.metro.scales.color;
                const x = vis.metro.scales.x;
                const y = vis.metro.scales.y;

                // prepara

                // valores ??nicos dos instrumentos
                const instrumentos = data
                  .map(d => d.instrumento_inicial)
                  .filter((v, i, a) => a.indexOf(v) === i);

                let pares = [];
                
                instrumentos.forEach(inst => {

                    const ocorrencias = data.filter(d => d.instrumento_inicial == inst);

                    let next = 0;

                    while (next < ocorrencias.length - 1) {

                        const par = [ocorrencias[next], ocorrencias[next+1]]

                        pares.push(par);

                        next++

                    }

                })

                console.log(pares);

                svg
                  .selectAll('line.metro-connecting-lines')
                  .data(pares)
                  .join('line')
                  .classed('metro-connecting-lines', true)
                  .attr('y1', d => y(d[0].date))
                  .attr('y2', d => y(d[1].date))
                  .attr('x1', d => x(d[0].agrupamento))
                  .attr('x2', d => x(d[1].agrupamento));


            }
        },

    },

    anotacoes : {

        ref : '.metro-wrapper',

        lado_direito: ['MP n?? 935/2020'],

        sizes : {

            metro_esquerdo : null,
            metro_direito : null,
            w_max : null,

            calcula : function() {

                [this.metro_esquerdo, this.metro_direito] = vis.metro.scales.x.range();

                this.w_max = Math.min(this.metro_esquerdo, 300);
        
            }

        },

        marca_instrumentos : function() {

            const data = vis.data.metro.anotacoes;
            const svg = d3.select(vis.metro.refs.svg);
            const color = vis.metro.scales.color;
            const x = vis.metro.scales.x;
            const y = vis.metro.scales.y;

            svg
              .selectAll('circle.metro-tem-anotacao')
              .data(data)
              .join('circle')
              .classed('metro-tem-anotacao', true)
              .attr('cx', d => x(d.agrupamento))
              .attr('cy', d => y(d.date));

        },


        inclui : function() {

            const cont = d3.select(this.ref);
            const data = vis.data.metro.anotacoes;
            const x = vis.metro.scales.x;
            const y = vis.metro.scales.y;
            const sizes = vis.anotacoes.sizes;
            const lado_direito = this.lado_direito;

            const divs = cont
              .selectAll('div.metro-anotacoes-fixas')
              .data(data)
              .join('div')
              .classed('metro-anotacoes-fixas', true)
              .style('top', d => y(d.date) + 'px')
              .style('left', d => (lado_direito.includes(d.instrumento) ? sizes.metro_direito : 0) + 'px')
              .style('width', sizes.w_max + 'px');

            divs.append('h4').html(d => d3.timeFormat("%d/%m/%Y")(d.date) + ' &mdash; ' + d.instrumento);
            divs.append('p').text(d => d.anotacao_fixa);

        },

        linha_anotacao : function() {

            const data = vis.data.metro.anotacoes;
            const svg = d3.select(vis.metro.refs.svg);
            const x = vis.metro.scales.x;
            const y = vis.metro.scales.y;
            const lado_direito = this.lado_direito;
            const sizes = vis.anotacoes.sizes;

            svg
              .selectAll('line.metro-linha-anotacao')
              .data(data)
              .join('line')
              .classed('metro-linha-anotacao', true)
              .attr('x1', d => x(d.agrupamento))
              .attr('x2', d => lado_direito.includes(d.instrumento) ? sizes.metro_direito : 10)
              .attr('y1', d => y(d.date))
              .attr('y2', d => y(d.date));



        }

    },

    interacoes : {

        seletor_tipo_despesa : {

            ref: '#tipo-valor',

            monitora : function() {

                const el = document.querySelector(this.ref);

                el.addEventListener('change', e => {

                    const opcao = e.target.value;

                    console.log(opcao);

                    // atualiza o streamgraph
                    vis.stream.change(opcao);

                })


            }

        },

        botao_modo : {

            ref: '#toggle-modo',

            monitora : function() {

                const btn = document.querySelector(this.ref);
                const cont = document.querySelector('.main-vis');

                btn.addEventListener('click', function(e) {

                    cont.classList.toggle('modo-stream');
                    console.log('mudei');

                })

            }
        },

        tooltips : {

            ref: '.tooltip-instrumento',

            popula_e_mostra : function(e) {

                console.log(e, e.target);

                const tt = document.querySelector(vis.interacoes.tooltips.ref);
                const data = vis.data.metro.pontos;
                const y = vis.metro.scales.y;
                const sizes = vis.anotacoes.sizes;

                const campos = ['date', 'anotacao', 'ementa', 'instrumento', 'link', 'classificacao_painel'];

                campos.forEach(campo => {

                    const el = tt.querySelector('[data-proposicao-' + campo);

                    if (campo == 'link') {

                        el.href = e.target.__data__[campo];

                    } else {

                        let raw_data = e.target.__data__[campo];

                        if (campo == 'date') raw_data = d3.timeFormat("%d de %B de %Y")(raw_data);

                        el.innerHTML = raw_data;

                    }

                })

                const pos_y = y(e.target.__data__.date) - 20;

                tt.style.transform = `translate(-50%, calc(${pos_y}px - 100%))`;

                tt.classList.add('tooltip-visivel');

                // primeiro checa se j?? existe um ponto clicado, a?? remove a classe ante
                const ponto_selecionado = document.querySelector('.metro-instrumentos-destaque');
                if (ponto_selecionado) ponto_selecionado.classList.remove('metro-instrumentos-destaque');

                e.target.classList.add('metro-instrumentos-destaque');

                // monitora cliques fora para fechar o tooltip
                vis.interacoes.tooltips.monitora_fechar('on');

            },

            monitora_fechar : function(chave) {

                const bkg = document.querySelector('.fechar-tooltip')

                if (chave == 'on') {

                    console.log('turning on');

                    bkg.addEventListener('click',  vis.interacoes.tooltips.esconde);
                    bkg.classList.add('monitorando-cliques');

                } else {

                    console.log('turning off');

                    bkg.removeEventListener('click',  vis.interacoes.tooltips.esconde);
                    bkg.classList.remove('monitorando-cliques');

                }

            },

            esconde : function(e) {

                const tt = document.querySelector(vis.interacoes.tooltips.ref);
                tt.classList.remove('tooltip-visivel');

                const ponto_selecionado = document.querySelector('.metro-instrumentos-destaque');
                if (ponto_selecionado) ponto_selecionado.classList.remove('metro-instrumentos-destaque');

                // remove monitor de cliques fora do tooltip
                vis.interacoes.tooltips.monitora_fechar('off');
                

                // const tg = e.target;
                // const parent = tg.parentNode;
                // const grandparent = parent.parentNode;

                // //console.log('clique background', e.target, e.target.parentNode, e.target.parentNode.parentNode);
                // //console.log(tg.classList.contains('metro-instrumentos'));

                // if (

                //     tg.classList.contains('.tooltip-instrumento') ||
                //     parent.classList.contains('.tooltip-instrumento') ||
                //     grandparent.classList.contains('.tooltip-instrumento') ||
                //     tg.classList.contains('metro-instrumentos')

                //     ) {
                //         console.log('clique no tooltip, ou em outro ponto -- mant??m tooltip');

                //     } else {

                //         console.log('clique fora do tooltip ou do ponto, fechar');

                //         const tt = document.querySelector(vis.interacoes.tooltips.ref);
                //         tt.classList.remove('tooltip-visivel');

                //         const ponto_selecionado = document.querySelector('.metro-instrumentos-destaque');
                //         if (ponto_selecionado) ponto_selecionado.classList.remove('metro-instrumentos-destaque');

                //         // remove monitor de cliques fora do tooltip
                //         vis.interacoes.tooltips.monitora_fechar('off');
                        


                //     }

            },

            monitora : function() {

                const pontos = d3.selectAll('circle.metro-instrumentos');

                pontos.on('click', vis.interacoes.tooltips.popula_e_mostra);

            }

        },

        hover_meses : {
            
            monitora : function() {

                const ticks = document.querySelectorAll('g.axis g.tick');

                ticks.forEach(
                    
                    tick => {
                        
                        tick.addEventListener('mouseenter', vis.interacoes.hover_meses.enter);
                        tick.addEventListener('mouseleave', vis.interacoes.hover_meses.exit);

                    }
                );


            },

            enter : function(e) {

                d3.select(this).classed('highlight', true);

                const date = d3.select(this).datum();
                vis.stream.regua_legenda.update(date);

            },

            exit : function(e) {

                d3.select('g.axis g.tick.highlight').classed('highlight', false);

                console.log('saiu');
                vis.stream.regua_legenda.update();

            }

        }


    },

    utils :  {

        localeBrasil : {

            "decimal": ",",
            "thousands": ".",
            "grouping": [3],
            "currency": ["R$", ""]

        },
          
        //https://cdn.jsdelivr.net/npm/d3-time-format@2/locale/pt-BR.json
        localeDataBrasil : {

            "dateTime": "%A, %e de %B de %Y. %X",
            "date": "%d/%m/%Y",
            "time": "%H:%M:%S",
            "periods": ["AM", "PM"],
            "days": ["Domingo", "Segunda", "Ter??a", "Quarta", "Quinta", "Sexta", "S??bado"],
            "shortDays": ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "S??b"],
            "months": ["Janeiro", "Fevereiro", "Mar??o", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
            "shortMonths": ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

        }

    },

    texto : {

        ref : '[data-super-grupo]',

        popula_totais : function() {

            const els = document.querySelectorAll(this.ref);

            els.forEach(el => {

                const tipo = el.dataset.superGrupo;

                const valor = (vis.data.totais[tipo]/1e9).toFixed(0);

                el.innerHTML = valor;

            })



        }


    },



    ctrl : {

        init : function() {

            vis.svg_background.get_document_size();
            vis.svg_background.set_svg_size();
            vis.line.get_left_space();
            vis.line.draw();
            
            vis.data.load();

        },

        // after data is loaded
        begin : function() {


            //vis.data.calcula_totais(); // para popular o texto
            //vis.texto.popula_totais();

            vis.data.stacked  = vis.data.make_stack(vis.data.raw);
            vis.data.stacked_mensal  = vis.data.make_stack(vis.data.mensal);

            // expand background line
            vis.line.expand();

            vis.stream.sizes.get();
            vis.stream.sizes.set();
            vis.stream.scales.set();
            vis.stream.area.set();
            vis.stream.draw();
            vis.stream.axis();
            vis.stream.faz_eixo_x('acumulado');
            vis.stream.regua_legenda.init();

            vis.interacoes.hover_meses.monitora();

            vis.metro.sizes.get();
            vis.metro.sizes.set();
            vis.metro.scales.set();
            //vis.metro.draw.lines();


            // ordem importante para definir o que sobrep??e o qu??
            vis.metro.draw.connecting_lines();
            vis.metro.draw.lines();
            vis.metro.draw.pontos();

            vis.anotacoes.sizes.calcula();
            vis.anotacoes.linha_anotacao();
            vis.anotacoes.marca_instrumentos();
            vis.anotacoes.inclui();

            vis.interacoes.seletor_tipo_despesa.monitora();
            vis.interacoes.botao_modo.monitora();
            vis.interacoes.tooltips.monitora();

        },

        resize : function() {

            // //  n??o est?? sendo usado // // 

            // update metro scale

            const cont_metro = document.querySelector(vis.metro.refs.container);
            const width_metro = +window.getComputedStyle(cont_metro).getPropertyValue("width").slice(0,-2);
            const dominio = vis.data.metro.extremos.map(d => d.agrupamento);
            const largura_necessaria = dominio.length * 20;

            const range_metro = [

                (width_metro - largura_necessaria) / 2,
                width_metro - (width_metro - largura_necessaria) / 2,

            ];

            vis.metro.scales.x.range(range_metro);

            // update metro

            const svg = d3.select(vis.metro.refs.svg);
            const svg_el = document.querySelector(vis.metro.refs.svg);
            const svg_width = +window.getComputedStyle(svg_el).getPropertyValue('width').slice(0,-2)

            const extremos = vis.data.metro.extremos;
            const margin_metro = vis.metro.sizes.margins;

            const x = vis.metro.scales.x;
            const y = vis.metro.scales.y;

            const data_metro = {};

            extremos.forEach(linha => {

                data_metro[linha.agrupamento] = [

                    {
                        y : margin_metro.top/2,
                        x : svg_width/2 - vis.line.stroke//vis.line.x - margin_left
                        // aqui t?? confiando no css, que calculou a largura do wrapper como sendo igual ?? margem esquerda do texto acima.
                    },

                    {

                        y : y(linha.date_inicial),
                        x : x(linha.agrupamento)

                    },

                    {

                        y : y(linha.date_final),
                        x : x(linha.agrupamento)
                    }

                ];

            });

            const line_gen = d3.line()
              .x(d => d.x)
              .y(d => d.y)
              .curve(d3.curveBumpY);

            extremos.forEach(serie => {

                const agrupamento = serie.agrupamento;

                svg
                    .select('path[data-agrupamento="' + agrupamento + '"]')
                    .datum(data_metro[agrupamento])
                    .attr('d', line_gen)
            })

            // update stream scale

            const margin = vis.stream.sizes.margins;

            const cont_stream = document.querySelector(vis.stream.refs.container);
            const width_stream = +window.getComputedStyle(cont_stream).getPropertyValue("width").slice(0,-2);

            vis.stream.scales.x.range([margin.left, width_stream - margin.right]);

            // update stream chart

        }

    }

}

vis.ctrl.init();