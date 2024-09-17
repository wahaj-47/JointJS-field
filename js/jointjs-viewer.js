(function ($, Drupal) {
    Drupal.behaviors.jointjsFormatter = {
        attach: function (context, settings) {
            once('jointjs-view', '.jointjs-view', context).forEach(function (element) {
                const namespace = joint.shapes;
                const graph = new joint.dia.Graph({}, { cellNamespace: namespace });
                const paper = new joint.dia.Paper({
                    el: element,
                    model: graph,
                    gridSize: 10,
                    width: $(element).width(),
                    height: $(element).height(),
                    cellViewNamespace: namespace,
                    interactive: false,
                    background: { color: '#FFFFFF' },
                });
                const json = $(element).data("diagram")
                graph.fromJSON(json);

                paper.transformToFitContent({ verticalAlign: 'middle', horizontalAlign: 'middle', padding: 20 });

                // Zoom functionality
                const zoomStep = 0.1;
                const minZoom = 0.5;
                const maxZoom = 2;

                paper.on("blank:mousewheel", function (e, x, y, delta) {
                    e.preventDefault();
                    const { sx: sx0 } = paper.scale();
                    paper.scaleUniformAtPoint(clamp(sx0 + zoomStep * delta, minZoom, maxZoom), { x, y });
                })

                paper.on('paper:pinch', function (evt, x, y, sx) {
                    evt.preventDefault();
                    const { sx: sx0 } = paper.scale();
                    paper.scaleUniformAtPoint(clamp(sx0 * sx, minZoom, maxZoom), { x, y });
                })

                function clamp(num, min, max) {
                    return Math.min(Math.max(num, min), max)
                }

                // constiables to store pan state
                const panStart = { x: 0, y: 0 };
                const paperStart = { x: 0, y: 0 };
                let isPanning = false;

                // Detect pointer down to start panning
                paper.on('blank:pointerdown', function (e) {
                    panStart.x = e.clientX;
                    panStart.y = e.clientY;
                    const translate = paper.translate();
                    paperStart.x = translate.tx;
                    paperStart.y = translate.ty;
                    isPanning = true;

                    $(element).css({ cursor: "grabbing" })
                });

                // Handle pointer move event for panning
                paper.on('blank:pointermove', function (e) {
                    if (isPanning) {
                        // Calculate the difference between the current mouse position and the initial pan start
                        const dx = e.clientX - panStart.x;
                        const dy = e.clientY - panStart.y;

                        // Apply the difference to the original paper position
                        paper.translate(paperStart.x + dx, paperStart.y + dy);
                    }
                });

                // Detect pointer up to stop panning
                paper.on('blank:pointerup', function () {
                    isPanning = false;
                    $(element).css({ cursor: "grab" })
                });

                $(window).on("resize", function () {
                    paper.setDimensions($(element).parent().width(), $(element).parent().height())
                    paper.transformToFitContent({ verticalAlign: 'middle', horizontalAlign: 'middle', padding: 20 });
                });
            });
        }
    };
})(jQuery, Drupal);
