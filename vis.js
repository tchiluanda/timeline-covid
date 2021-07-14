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
              (+data['Medidas Sanitárias'] / 1)
              + (+data['Proteção Social'] / 1)
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
                bottom: 20,
                top: 160

            },

            get : function() {

                const cont = document.querySelector(vis.stream.refs.container);

                this.width = +window.getComputedStyle(cont).getPropertyValue("width").slice(0,-2)

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

            const area = vis.stream.area.generator;

            d3.selectAll('path.streamgraph')
              .data(data)
              .transition()
              .duration(1000)
              .attr('d', area);

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
                bottom: 20,
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

                const data = {};

                extremos.forEach(linha => {

                    data[linha.agrupamento] = [

                        {
                            y : margin.top/2,
                            x : vis.line.x
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
                  .attr('cy', d => y(d.date))
                  //.attr('fill', 'black')
                  .append('title')
                    .text(d => d.instrumento);

            },

            connecting_lines : function() {

                const data = vis.data.metro.multiplos;
                const svg = d3.select(vis.metro.refs.svg);
                const color = vis.metro.scales.color;
                const x = vis.metro.scales.x;
                const y = vis.metro.scales.y;

                // prepara

                // valores únicos dos instrumentos
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

        lado_direito: ['MP nº 935/2020'],

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

            monitor : function() {

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

            populate : function(e) {

                console.log(e, e.target);

                const tt = document.querySelector(vis.interacoes.tooltips.ref);
                const data = vis.data.metro.pontos;
                const y = vis.metro.scales.y;
                const sizes = vis.anotacoes.sizes;

                const campos = ['date', 'anotacao', 'ementa', 'instrumento', 'link'];

                campos.forEach(campo => {

                    const el = tt.querySelector('[data-proposicao-' + campo);

                    if (campo == 'link') {

                        el.href = e.target.__data__[campo];

                    } else {

                        let raw_data = e.target.__data__[campo];

                        if (campo == 'date') raw_data = d3.timeFormat("de %d de %B de %Y")(raw_data);

                        el.innerHTML = raw_data;

                    }

                })

                const pos_y = y(e.target.__data__.date) - 20;

                tt.style.transform = `translate(-50%, calc(${pos_y}px - 100%))`;
                tt.classList.add('tooltip-visivel');

                e.target.classList.add('metro-instrumentos-destaque');

            },

            monitora_fechar : function() {

                const bkg = document.querySelector('.main-vis');

                bkg.addEventListener('click', function(e) {

                    console.log('outside', e.target);


                })



            },

            monitora : function() {

                const pontos = d3.selectAll('circle.metro-instrumentos');

                pontos.on('click', vis.interacoes.tooltips.populate);
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
            "days": ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
            "shortDays": ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
            "months": ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
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


            vis.data.calcula_totais(); // para popular o texto
            vis.texto.popula_totais();

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

            vis.metro.sizes.get();
            vis.metro.sizes.set();
            vis.metro.scales.set();
            //vis.metro.draw.lines();


            // ordem importante para definir o que sobrepõe o quê
            vis.metro.draw.connecting_lines();
            vis.metro.draw.lines();
            vis.metro.draw.pontos();

            vis.anotacoes.sizes.calcula();
            vis.anotacoes.linha_anotacao();
            vis.anotacoes.marca_instrumentos();
            vis.anotacoes.inclui();

            vis.interacoes.seletor_tipo_despesa.monitora();
            vis.interacoes.botao_modo.monitor();
            vis.interacoes.tooltips.monitora();
            vis.interacoes.tooltips.monitora_fechar();


        }

    }

}

vis.ctrl.init();