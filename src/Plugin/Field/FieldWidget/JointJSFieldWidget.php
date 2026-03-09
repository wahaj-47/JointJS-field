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
  field_types: [
    "jointjs_field"
  ],
)]
class JointJSFieldWidget extends WidgetBase
{

  /**
   * {@inheritdoc}
   */
  public function formElement(FieldItemListInterface $items, $delta, array $element, array &$form, FormStateInterface $form_state) {

    $value = $items[$delta]->value ?? '';

    // The hidden textarea that stores the base64 JSON.
    $element['value'] = [
      '#type' => 'textarea',
      '#default_value' => $value,
      '#attributes' => [
        'class' => ['jointjs-data'],
      ],
    ];

    // Node wizard container (not a form element, just markup).
    $element['node_wizard'] = [
      '#type' => 'container',
      '#attributes' => [
        'id' => 'node-wizard',
        'class' => ['node-wizard'],
        'style' => 'display:none;',
      ],
    ];

    // CKEditor text_format input (this *must* be a real input).
    $element['node_wizard']['label_input'] = [
      '#type' => 'text_format',
      '#title' => $this->t('Label'),
      '#format' => 'rich_text',
      '#default_value' => '',
      '#attributes' => [
        'class' => ['label-input'],
      ],
    ];

    // Checkbox (must be a real input, not #input = FALSE).
    $element['node_wizard']['text_only'] = [
      '#type' => 'checkbox',
      '#title' => $this->t('Text only'),
      '#attributes' => [
        'class' => ['text-only'],
      ],
    ];

    // Wizard footer container.
    $element['node_wizard']['footer'] = [
      '#type' => 'container',
      '#attributes' => [
        'class' => ['node-wizard-footer'],
      ],
    ];

    // Create button (HTML only, NOT a Drupal submit button).
    $element['node_wizard']['footer']['create_button'] = [
      '#type' => 'html_tag',
      '#tag' => 'button',
      '#value' => $this->t('Create'),
      '#attributes' => [
        'class' => ['create-button', 'button'],
        'type' => 'button',
      ],
    ];

    // Update button (HTML only, NOT a Drupal submit button).
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

    // Hidden measurement div.
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

    // The actual JointJS editor canvas.
    $element['diagram_editor'] = [
      '#type' => 'container',
      '#attributes' => [
        'id' => 'jointjs-editor-' . $delta,
        'class' => ['jointjs-editor'],
        'style' => 'width:800px; height:800px;',
      ],
    ];

    // Attach JS + CSS.
    $element['#attached']['library'][] = 'jointjs_field/jointjs.editor';

    return $element;
  }
}
