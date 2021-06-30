const vis = {

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



    ctrl : {

        init : function() {

            vis.svg_background.get_document_size();
            vis.svg_background.set_svg_size();
            vis.line.get_left_space();
            vis.line.draw();
        }

    }

}

vis.ctrl.init();