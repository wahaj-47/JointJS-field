(function ($, Drupal) {
    Drupal.behaviors.jointjsFormatter = {
        attach: function (context, settings) {
            once('jointjs-view', '.jointjs-view', context).forEach(function (element) {

                const Node = joint.dia.Element.define('Node', {
                    attrs: {
                        body: {
                            width: 'calc(w)',
                            height: 'calc(h)',
                            fill: '#F5F5F5',
                            stroke: 'black',
                            strokeWidth: 2,
                            rx: 4,
                        },
                        foreignObject: {
                            width: 'calc(w-12)',
                            height: 'calc(h-12)',
                            x: 6,
                            y: 6
                        },
                        htmlContent: {
                            html: '<p>Placeholder content</p>'
                        }
                    },
                }, {
                    // The /* xml */ comment is optional.
                    // It is used to tell the IDE that the markup is XML.
                    markup: joint.util.svg/* xml */`
                        <rect @selector="body"/>
                        <foreignObject @selector="foreignObject" style="text-align: center;">
                            <div xmlns="http://www.w3.org/1999/xhtml" @selector="htmlContent" 
                            class="node-div">
                            </div>
                        </foreignObject>
                    `
                })

                const namespace = { ...joint.shapes, Node };
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

                $('.jointjs-download-btn').on('click', function () {
                    paper.transformToFitContent({ verticalAlign: 'top', horizontalAlign: 'left', padding: 20 });
                    const scaleFactor = 3;
                    const bbox = paper.getContentBBox();
                    const width = bbox.width * scaleFactor
                    const height = bbox.height * scaleFactor

                    // Serialize the SVG to a string
                    const svgData = new XMLSerializer().serializeToString(paper.svg);
                    const svgDataBase64 = btoa(unescape(encodeURIComponent(svgData)));
                    const svgDataUrl = `data:image/svg+xml;charset=utf-8;base64,${svgDataBase64}`;

                    const image = new Image();
                    image.src = svgDataUrl;

                    image.addEventListener('load', () => {
                        // Use viewBox dimensions instead of getBBox to avoid cropping
                        const canvas = document.createElement('canvas');
                        canvas.width = width + 40;
                        canvas.height = height + 40

                        const context = canvas.getContext('2d');
                        context.fillStyle = "white";  // Set background to white
                        context.fillRect(0, 0, width, height);

                        context.drawImage(image, 0, 0, (width - 40) * scaleFactor, (height - 40) * scaleFactor);

                        // Create a link to download the image
                        const link = document.createElement('a');
                        link.download = 'diagram.png';
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        paper.transformToFitContent({ verticalAlign: 'middle', horizontalAlign: 'middle', padding: 20 });

                    });
                });
            });
        }
    }
})(jQuery, Drupal);
