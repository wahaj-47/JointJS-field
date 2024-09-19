(function ($, Drupal, once) {
    Drupal.behaviors.jointjsEditor = {
        attach: function (context, settings) {
            once('jointjs-editor', '.jointjs-editor', context).forEach(function (element) {
                // 
                // Editor setup ----  Start
                // 
                const editorId = $(element).attr('id');
                const hiddenField = $('.jointjs-data')
                const nodeWizard = $('#node-wizard')
                const labelField = $('#label-input')
                const textOnly = $('#edit-field-diagram-0-node-wizard-footer-text-only')
                const createButton = $('#edit-field-diagram-0-node-wizard-footer-create-button');
                const updateButton = $('#edit-field-diagram-0-node-wizard-footer-update-button');
                const diagramData = hiddenField.val()

                const namespace = joint.shapes;

                // Initialize the JointJS diagram editor.
                const graph = new joint.dia.Graph({}, { cellNamespace: namespace });
                const defaultLink = new joint.shapes.standard.Link({
                    attrs: {
                        line: {
                            stroke: 'black',
                            strokeWidth: 2,
                            targetMarker: { type: 'none' }
                        }
                    }
                });

                const paper = new joint.dia.Paper({
                    el: document.getElementById(editorId),
                    model: graph,
                    gridSize: 10,
                    height: 800,
                    background: { color: '#F5F5F5' },
                    cellViewNamespace: namespace,
                    defaultLink: defaultLink,
                    snapLabel: true,
                    interactive: {
                        labelMove: true
                    }
                });

                // If there's existing data, load it into the diagram.
                if (diagramData) {
                    const json = JSON.parse(diagramData);
                    graph.fromJSON(json);
                    graph.getElements().forEach(function (element) {
                        addElementTools(element)
                    })
                    graph.getLinks().forEach(function (link) {
                        addLinkTools(link)
                    })
                    paper.transformToFitContent({ verticalAlign: 'middle', horizontalAlign: 'middle' });
                }

                graph.on('change', function (cell) {
                    console.log("Graph changed")
                    updateHiddenInput()
                })

                graph.on('add', function (cell) {
                    console.log("Added a cell to the graph")
                    updateHiddenInput();

                    if (cell.isLink()) {
                        addLinkTools(cell)
                    }
                })

                graph.on('remove', function (cell) {
                    console.log("Removed a cell from the graph")
                    updateHiddenInput();
                })

                labelField.on('keydown', function (e) {
                    if (e.key == 'Escape') {
                        hideTools();
                    }
                })

                createButton.on('click', function () {
                    createNode(labelField.val(), nodeWizard.data("x"), nodeWizard.data("y"), textOnly.is(":checked"))
                })

                updateButton.on('click', function () {
                    updateNode(nodeWizard.data("node"), labelField.val(), textOnly.is(":checked"));
                })

                // 
                // Editor Setup ---- End
                // 

                // ===================================================== //

                //
                // Editor Utils ---- Start
                // 

                // Zoom functionality
                const zoomStep = 0.1;
                const minZoom = 0.5;
                const maxZoom = 2;

                paper.on("blank:mousewheel", function (e, x, y, delta) {
                    e.preventDefault();
                    hideTools();

                    const { sx: sx0 } = paper.scale();
                    paper.scaleUniformAtPoint(clamp(sx0 + zoomStep * delta, minZoom, maxZoom), { x, y });
                })

                paper.on('paper:pinch', function (evt, x, y, sx) {
                    evt.preventDefault();
                    hideTools();

                    const { sx: sx0 } = paper.scale();
                    paper.scaleUniformAtPoint(clamp(sx0 * sx, minZoom, maxZoom), { x, y });
                })

                // constiables to store pan state
                const panStart = { x: 0, y: 0 };
                const paperStart = { x: 0, y: 0 };
                let isPanning = false;

                // Detect pointer down to start panning
                paper.on('blank:pointerdown', function (e) {
                    hideTools();

                    panStart.x = e.clientX;
                    panStart.y = e.clientY;
                    const translate = paper.translate();
                    paperStart.x = translate.tx;
                    paperStart.y = translate.ty;
                    isPanning = true;
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
                });

                paper.on('blank:pointerdblclick', function (e, x, y) {
                    const clientCoords = paper.localToClientPoint(x, y)

                    nodeWizard.css({
                        top: clientCoords.y + window.scrollY + 'px',
                        left: clientCoords.x + window.scrollX + 'px',
                        display: 'block'
                    })
                    nodeWizard.data("x", x);
                    nodeWizard.data("y", y);
                    labelField.focus();
                })

                paper.on('element:pointerclick', function (elementView, e, x, y) {
                    hideTools();
                    elementView.showTools();
                })

                paper.on('link:pointerclick', function (linkView, e, x, y) {
                    hideTools();
                    linkView.showTools();
                })

                paper.on('element:pointerdblclick', function (elementView, e, x, y) {
                    const element = elementView.model;
                    const clientCoords = paper.localToClientPoint(x, y)

                    createButton.hide()
                    updateButton.show()

                    nodeWizard.css({
                        top: clientCoords.y + window.scrollY + 'px',
                        left: clientCoords.x + window.scrollX + 'px',
                        display: 'block'
                    })

                    nodeWizard.data("node", element);
                    labelField.val(element.attr(['label', 'text']))

                    if (element.attr(['body', 'stroke']) == 'transparent')
                        textOnly.prop('checked', true);
                    else
                        textOnly.prop('checked', false);

                    labelField.focus();
                })

                // 
                // Editor Utils ---- End
                //

                function clamp(num, min, max) {
                    return Math.min(Math.max(num, min), max)
                }

                function getLabelSize(labelText) {
                    const measureDiv = $('#label-measure');
                    $(measureDiv).text(labelText);
                    return { width: $(measureDiv).outerWidth(), height: $(measureDiv).outerHeight() };
                }

                function hideTools() {
                    paper.hideTools();
                    labelField.val("");
                    textOnly.prop('checked', false);
                    nodeWizard.css({ display: "none" });
                    createButton.show()
                    updateButton.hide()
                }

                function createNode(labelText, x, y, textOnly = false) {
                    const element = new joint.shapes.standard.Rectangle();
                    const { width, height } = getLabelSize(labelText);
                    element.position(x, y);
                    element.resize(width + 24, height + 24);
                    element.attr({
                        body: {
                            fill: 'transparent',
                            stroke: textOnly ? 'transparent' : 'black',
                            rx: 4,
                        },
                        label: {
                            text: labelText,
                            fill: 'black',
                            textWrap: {
                                width: -10,  // Width of the wrapped text (auto-fits to the element width)
                                height: 'auto',  // Height of the text block, 'auto' allows dynamic height
                                ellipsis: true, // If text overflows, use ellipsis
                            },
                        },
                    });

                    element.addTo(graph)
                    addElementTools(element)
                    hideTools();
                }

                function updateNode(node, labelText, textOnly) {
                    const { width, height } = getLabelSize(labelText);
                    node.attr(['label', 'text'], labelText)
                    node.attr(['body', 'stroke'], textOnly ? 'transparent' : 'black')
                    node.prop('size/width', width + 12)
                    node.prop('size/height', height + 12)
                    hideTools();
                }

                function updateHiddenInput() {
                    const json = JSON.stringify(graph.toJSON());
                    hiddenField.val(json);
                }

                function addElementTools(element) {
                    const elementView = element.findView(paper);

                    const RemoveButton = new joint.elementTools.Remove();
                    const ConnectButton = new joint.elementTools.Connect({
                        x: '100%',
                        y: '100%',
                        magnet: 'body'
                    });
                    const cCrossedLinesTool = new joint.elementTools.Button({
                        markup: [{
                            tagName: 'circle',
                            selector: 'button',
                            attributes: {
                                'r': 7,
                                'fill': 'white',
                                'cursor': 'pointer'
                            }
                        }, {
                            tagName: 'path',
                            selector: 'icon',
                            attributes: {
                                'd': 'M -4 -4 L 4 4 M -4 4 L 4 -4',
                                'fill': 'none',
                                'stroke': 'gray',
                                'stroke-width': 1,
                                'pointer-events': 'none'
                            }
                        }],
                        x: '100%',
                        y: 0,
                        action: function (evt, elementView) {
                            const element = elementView.model;
                            let size = element.getBBox()
                            size = size.scale(1.2, 1.2, size.center())

                            const lineOne = new joint.shapes.standard.Link();
                            const lineTwo = new joint.shapes.standard.Link();
                            const lineConfig = {
                                line: {
                                    stroke: 'gray',
                                    'stroke-width': 2, // Adjust stroke width if needed
                                    'stroke-opacity': 0.5, // Set opacity to 50%
                                    targetMarker: { type: 'none' }
                                },
                            }

                            lineOne.prop('source', size.topLeft());
                            lineOne.prop('target', size.bottomRight());
                            lineOne.attr(lineConfig);

                            lineTwo.prop('source', size.topRight());
                            lineTwo.prop('target', size.bottomLeft());
                            lineTwo.attr(lineConfig);

                            lineOne.addTo(graph)
                            lineTwo.addTo(graph)
                        }
                    });

                    const toolsView = new joint.dia.ToolsView({
                        name: 'basic-tools',
                        tools: [RemoveButton, ConnectButton, cCrossedLinesTool]
                    });

                    elementView.addTools(toolsView);
                    elementView.hideTools()
                }

                function addLinkTools(link) {
                    const linkView = link.findView(paper);
                    const RemoveButton = new joint.linkTools.Remove({ distance: "50%", offset: 10 });
                    const VerticesTool = new joint.linkTools.Vertices();
                    const SegmentsTool = new joint.linkTools.Segments();
                    const cSourceArrowheadTool = new joint.linkTools.Button({
                        markup: [{
                            tagName: 'circle',
                            selector: 'button',
                            attributes: {
                                'r': 7,
                                'fill': '#003ecc',
                                'cursor': 'pointer'
                            }
                        }],
                        distance: '10%',
                        offset: -10,
                        action: function (evt, linkView) {
                            // Toggle the source arrowhead
                            const currentMarker = linkView.model.attr('line/sourceMarker');
                            if (currentMarker && currentMarker.type === 'path') {
                                linkView.model.attr('line/sourceMarker', { type: 'none' });
                            } else {
                                linkView.model.attr('line/sourceMarker', {
                                    type: 'path',
                                    d: 'M 10 -5 0 0 10 5 Z', // Custom arrowhead
                                    fill: 'black'
                                });
                            }
                        }
                    });
                    const cTargetArrowheadTool = new joint.linkTools.Button({
                        markup: [
                            {
                                tagName: 'circle',
                                selector: 'button',
                                attributes: {
                                    'r': 7,
                                    'fill': '#003ecc',
                                    'cursor': 'pointer'
                                }
                            },
                        ],
                        distance: '90%',
                        offset: 10,
                        action: function (evt, linkView) {
                            // Toggle the target arrowhead
                            const currentMarker = linkView.model.attr('line/targetMarker');
                            if (currentMarker && currentMarker.type === 'path') {
                                linkView.model.attr('line/targetMarker', { type: 'none' });
                            } else {
                                linkView.model.attr('line/targetMarker', {
                                    type: 'path',
                                    d: 'M 10 -5 0 0 10 5 Z', // Custom arrowhead
                                    fill: 'black'
                                });
                            }
                        }
                    });
                    const cDashedLineTool = new joint.linkTools.Button({
                        markup: [{
                            tagName: 'circle',
                            selector: 'button',
                            attributes: {
                                'r': 7,
                                'fill': '#3498DB', // Color for the tool button
                                'cursor': 'pointer'
                            }
                        }],
                        distance: '50%', // Place it in the middle of the link
                        offset: -10, // Offset from the link
                        action: function (evt, linkView) {
                            // Toggle the link line style between solid and dashed
                            const currentStyle = linkView.model.attr('line/strokeDasharray');
                            if (currentStyle === '5, 5') {
                                linkView.model.attr('line/strokeDasharray', null); // Make the line solid
                            } else {
                                linkView.model.attr('line/strokeDasharray', '5, 5'); // Make the line dashed
                            }
                        }
                    });

                    const toolsView = new joint.dia.ToolsView({
                        name: 'basic-tools',
                        tools: [
                            RemoveButton,
                            VerticesTool,
                            SegmentsTool,
                            cSourceArrowheadTool,
                            cTargetArrowheadTool,
                            cDashedLineTool,
                        ]
                    });

                    linkView.addTools(toolsView);
                    linkView.hideTools();
                }

            });
        }
    };
})(jQuery, Drupal, once);
