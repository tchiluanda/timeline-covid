const vis = {

    data : {

        raw : null,

        stacked : null,

        load : () => {

            d3.csv("./gastos.csv", d => {

                d['date'] = d3.timeParse("%Y-%m-%d")(d.mes_lancamento);
                d["data_br"] = d3.timeFormat("%B de %Y")(d.date);

                return d

            })
              .then(function(dados) {

                vis.data.raw = dados;
                vis.ctrl.begin();


            })

        },

        make_stack : (data) => {

            const stacked = d3.stack()
             .keys(data.columns.slice(2))
             .offset(d3.stackOffsetWiggle)
             .order(d3.stackOrderInsideOut)(data)

            return stacked;

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

        get_left_space : function() {

            const el = document.querySelector('.margenzona');

            this.left_space = el.getBoundingClientRect().left;

        },

        draw : function() {

            let x = this.left_space <= 100 ? vis.svg_background.width / 3 : this.left_space / 2 - this.stroke / 2;
            
            console.log(x);

            d3.select("svg#background")
              .append('line')
              .attr('x1', x)
              .attr('x2', x)
              .attr('y1', 0)
              .attr('y2', vis.svg_background.height)
              .attr('stroke-width', this.stroke)
              .attr('stroke', 'hotpink');




        }
        

    },

    stream : {

        refs : {

            svg: 'svg.stream',

            container : 'div.stream-wrapper'

        },

        sizes : {

            width: null,

            height: 1000,

            margins : {

                left: 0,
                right: 20,
                bottom: 0,
                top: 0

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
                  .domain(d3.extent(data, d => d.date))
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
                  .x1(d => scales.x(d[1]));

            }

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
              .attr("fill", ({key}) => color(key))
              .attr("d", area)
              .append("title")
              .text(({key}) => key);
        
            //svg.append("g")
            //  .call(xAxis);


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

            vis.data.stacked  = vis.data.make_stack(vis.data.raw);

            vis.stream.sizes.get();
            vis.stream.sizes.set();


            vis.stream.scales.set();

            vis.stream.area.set();

            vis.stream.draw();


        }

    }

}

vis.ctrl.init();