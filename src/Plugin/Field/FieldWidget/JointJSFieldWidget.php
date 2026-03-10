<?php

namespace Drupal\jointjs_field\Plugin\Field\FieldWidget;


use Drupal\Core\Field\Attribute\FieldWidget;
use Drupal\Core\Field\WidgetBase;
use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\StringTranslation\TranslatableMarkup;

/**
 * Plugin implementation of the 'jointjs_field_widget' widget.
 */
#[FieldWidget(
  id: "jointjs_field_widget",
  label: new TranslatableMarkup("JointJS Diagram Widget"),
  field_types: ["jointjs_field"]
)]
class JointJSFieldWidget extends WidgetBase {

  /**
   * {@inheritdoc}
   */
  public function formElement(FieldItemListInterface $items, $delta, array $element, array &$form, FormStateInterface $form_state) {

    $value = $items[$delta]->value ?? '';

    // ------------------------------------------------------------
    // Hidden base64 field (Drupal saves this)
    // ------------------------------------------------------------
    $element['value'] = [
      '#type' => 'textarea',
      '#default_value' => $value,
      '#attributes' => [
        'class' => ['jointjs-data'],
        'style' => 'display:none;',
      ],
    ];

    // ------------------------------------------------------------
    // Unlock / lock JSON editing controls (B2-1 inline confirmation)
    // ------------------------------------------------------------
    $element['json_controls'] = [
      '#type' => 'container',
      '#attributes' => ['class' => ['jointjs-json-controls']],
    ];

    // Unlock button
    $element['json_controls']['unlock'] = [
      '#type' => 'html_tag',
      '#tag' => 'button',
      '#value' => $this->t('Unlock JSON Editing'),
      '#attributes' => [
        'class' => ['jointjs-json-unlock', 'button'],
        'type' => 'button',
      ],
    ];

    // Lock button (hidden initially)
    $element['json_controls']['lock'] = [
      '#type' => 'html_tag',
      '#tag' => 'button',
      '#value' => $this->t('Lock JSON Editing'),
      '#attributes' => [
        'class' => ['jointjs-json-lock', 'button'],
        'type' => 'button',
        'style' => 'display:none;',
      ],
    ];

    // Inline confirmation warning
    $element['json_controls']['warning'] = [
      '#type' => 'container',
      '#attributes' => [
        'class' => ['jointjs-json-warning'],
        'style' => 'display:none; margin-top:0.5rem; padding:0.5rem; border:1px solid #f0ad4e; background:#fcf8e3;',
      ],
      'message' => [
        '#markup' => $this->t('Editing JSON directly can break diagrams. Only continue if you know what you are doing.'),
      ],
      'buttons' => [
        '#type' => 'container',
        '#attributes' => ['style' => 'margin-top:0.5rem;'],
        'confirm' => [
          '#type' => 'html_tag',
          '#tag' => 'button',
          '#value' => $this->t('Confirm JSON Editing'),
          '#attributes' => [
            'class' => ['jointjs-json-confirm', 'button'],
            'type' => 'button',
            'style' => 'margin-right:0.5rem;',
          ],
        ],
        'cancel' => [
          '#type' => 'html_tag',
          '#tag' => 'button',
          '#value' => $this->t('Cancel'),
          '#attributes' => [
            'class' => ['jointjs-json-cancel', 'button'],
            'type' => 'button',
          ],
        ],
      ],
    ];

    // ------------------------------------------------------------
    // Visible decoded JSON field (pre-populated with pretty JSON when possible)
    // ------------------------------------------------------------
    $decoded_json = '';
    if (!empty($value)) {
      $maybe = trim($value);
      // If it doesn't look like raw JSON, try base64 decode first.
      if (isset($maybe[0]) && $maybe[0] !== '{' && $maybe[0] !== '[') {
        $decoded = @base64_decode($maybe, true);
        if ($decoded !== false) {
          $tmp = json_decode($decoded);
          if ($tmp !== null) {
            $decoded_json = json_encode($tmp, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
          }
          else {
            // Not JSON after decode, show decoded string.
            $decoded_json = $decoded;
          }
        }
        else {
          // Not base64, try to pretty print if it's JSON
          $tmp = json_decode($maybe);
          $decoded_json = ($tmp !== null) ? json_encode($tmp, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) : $maybe;
        }
      }
      else {
        // Looks like JSON already
        $tmp = json_decode($maybe);
        $decoded_json = ($tmp !== null) ? json_encode($tmp, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) : $maybe;
      }
    }

    $element['decoded'] = [
      '#type' => 'textarea',
      '#title' => $this->t('Diagram JSON (decoded)'),
      '#default_value' => $decoded_json,
      '#attributes' => [
        'class' => ['jointjs-decoded'],
        'style' => 'width:100%; height:200px; font-family:monospace;',
        'readonly' => 'readonly',
      ],
    ];

    // ------------------------------------------------------------
    // Diagram editor wrapper + title
    // ------------------------------------------------------------  
    $element['diagram_editor_wrapper'] = [
      '#type' => 'container',
      '#attributes' => [
        'class' => ['jointjs-editor-wrapper'],
        'style' => 'margin-top:1rem;',
      ],
    ];

    $element['diagram_editor_wrapper']['title'] = [
      '#type' => 'html_tag',
      '#tag' => 'label',
      '#value' => $this->t('Diagram Editor'),
      '#attributes' => [
        'class' => ['jointjs-editor-title'],
        'style' => 'font-weight:bold; display:block; margin-bottom:0.5rem;',
      ],
    ];

    $element['diagram_editor_wrapper']['description'] = [
      '#type' => 'inline_template',
      '#template' => '<div class="form-item__description">{{ description|raw }}</div>',
      '#context' => [
        'description' => t('
          <ul>
            <li>Double click to create a new node.</li>
            <li>Click and drag to pan.</li>
            <li>Scroll to zoom.</li>
          </ul>
        '),
      ]
    ];

    $element['diagram_editor_wrapper']['diagram_editor'] = [
      '#type' => 'container',
      '#attributes' => [
        'id' => 'jointjs-editor-' . $delta,
        'class' => ['jointjs-editor'],
        // Make background transparent so the JointJS dot grid (drawGrid) can show through.
        'style' => 'width:800px; height:800px; position:relative; border:1px solid #ccc; background:transparent;',
      ],
    ];

    // $element['grid_toggle'] = [
    //   '#type' => 'checkbox',
    //   '#title' => $this->t('Show dot grid'),
    //   // enable by default so users see the grid; change to 0 if you prefer off by default
    //   '#default_value' => 1,
    //   '#attributes' => [
    //     'class' => ['jointjs-grid-toggle'],
    //     'style' => 'margin-bottom: 1rem;',
    //   ],
    // ];

    // ------------------------------------------------------------
    // Node wizard popup
    // ------------------------------------------------------------
    $element['node_wizard'] = [
      '#type' => 'container',
      '#attributes' => [
        'id' => 'node-wizard',
        'class' => ['node-wizard'],
        'style' => 'display:none; position:absolute; z-index:9999;',
      ],
    ];

    $element['node_wizard']['label_input'] = [
      '#type' => 'text_format',
      '#title' => $this->t('Label'),
      '#format' => 'rich_text',
      '#default_value' => '',
      '#attributes' => ['class' => ['label-input']],
    ];

    $element['node_wizard']['text_only'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Text only'),
      '#attributes' => ['class' => ['text-only']],
    ];

    $element['node_wizard']['footer'] = [
      '#type' => 'container',
      '#attributes' => ['class' => ['node-wizard-footer']],
    ];

    $element['node_wizard']['footer']['create_button'] = [
      '#type' => 'html_tag',
      '#tag' => 'button',
      '#value' => $this->t('Create'),
      '#attributes' => [
        'class' => ['create-button', 'button'],
        'type' => 'button',
      ],
    ];

    $element['node_wizard']['footer']['update_button'] = [
      '#type' => 'html_tag',
      '#tag' => 'button',
      '#value' => $this->t('Save'),
      '#attributes' => [
        'class' => ['update-button', 'button'],
        'type' => 'button',
        'style' => 'display:none;',
      ],
    ];

    // ------------------------------------------------------------
    // Hidden measurement div
    // ------------------------------------------------------------
    $element['label_measure'] = [
      '#type' => 'html_tag',
      '#tag' => 'div',
      '#attributes' => [
        'id' => 'label-measure',
        'class' => ['label-measure'],
        'style' => 'display:none;',
      ],
      '#value' => '<p>test</p>',
    ];

    // ------------------------------------------------------------
    // Attach JS + CSS libraries
    // ------------------------------------------------------------
    // Editor library (includes editor JS and ensures joint.css is loaded)
    $element['#attached']['library'][] = 'jointjs_field/jointjs.editor';
    // Viewer library (ensures joint.css is available for viewer pages too)
    $element['#attached']['library'][] = 'jointjs_field/jointjs.viewer';

    return $element;
  }
}