<?php

namespace Drupal\jointjs_field\Plugin\Field\FieldWidget;

use Drupal\Core\Field\WidgetBase;
use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\Form\FormStateInterface;

/**
 * Plugin implementation of the 'jointjs_field_widget' widget.
 *
 * @FieldWidget(
 *   id = "jointjs_field_widget",
 *   label = @Translation("JointJS Diagram Widget"),
 *   field_types = {
 *     "jointjs_field"
 *   }
 * )
 */
class JointJSFieldWidget extends WidgetBase
{

  /**
   * {@inheritdoc}
   */
  public function formElement(FieldItemListInterface $items, $delta, array $element, array &$form, FormStateInterface $form_state)
  {
    // Hidden field to store JointJS diagram data as JSON.
    $element['value'] = [
      '#type' => 'hidden',
      '#default_value' => isset($items[$delta]->value) ? $items[$delta]->value : '',
      '#attributes' => [
        'class' => ['jointjs-data']
      ],
    ];

    $element['node-wizard'] = [
      '#type' => 'container',
      '#attributes' => [
        'id' => 'node-wizard',
        'class' => ['node-wizard']
      ],
      'label-input' => [
        '#type' => 'text_format',
        '#format' => 'rich_text',
        '#value' => '',
        '#attributes' => [
          'class' => ['label-input'],
        ],
        '#input' => false,
        '#rows' => 10,
        '#cols' => 10
      ],
      'footer' => [
        '#type' => 'container',
        '#attributes' => [
          'class' => ['node-wizard-footer']
        ],
        'text-only' => [
          '#type' => 'checkbox',
          '#title' => t('Text only'),
          '#attributes' => [
            'class' => ['text-only', 'btn-check'],
          ],
          '#options' => [
            'class' => ['btn', 'btn-outline-primary'],
            'for' => 'text-only',
          ],
          '#input' => false,
          '#value' => 0
        ],
        'create-button' => [
          '#type' => 'button',
          '#value' => t('Create'),
          '#attributes' => [
            'class' => ['create-button'],
            'onclick' => 'return false'
          ],
        ],
        'update-button' => [
          '#type' => 'button',
          '#value' => t('Save'),
          '#attributes' => [
            'class' => ['update-button'],
            'onclick' => 'return false'
          ],
        ]
      ],

    ];

    // Empty div for measuring the label size before creating new nodes
    $element['label-measure'] = [
      '#type' => 'container',
      '#attributes' => [
        'id' => 'label-measure',
        'class' => ['label-measure'],
      ],
    ];

    $element['diagram_editor_title'] = [
      '#type' => 'inline_template',
      '#template' => '<label class="form-item__label js-form-required form-required">{{ title }}</label>',
      '#context' => [
        'title' => t('Diagram Editor'),
      ],
    ];

    $element['diagram_editor_description'] = [
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

    // Div for rendering JointJS editor.
    $element['diagram_editor'] = [
      '#type' => 'container',
      '#attributes' => [
        'id' => 'jointjs-editor-' . $delta,
        'class' => ['jointjs-editor'],
      ],
      '#attached' => [
        'library' => ['jointjs_field/jointjs.editor'],
      ],
    ];

    return $element;
  }
}
