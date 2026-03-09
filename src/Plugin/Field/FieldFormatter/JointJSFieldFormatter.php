<?php

namespace Drupal\jointjs_field\Plugin\Field\FieldFormatter;

use Drupal\Core\Field\Attribute\FieldFormatter;
use Drupal\Core\Field\FormatterBase;
use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\StringTranslation\TranslatableMarkup;

/**
 * Plugin implementation of the 'jointjs_field_formatter' formatter.
 */
#[FieldFormatter(
  id: "jointjs_field_formatter",
  label: new TranslatableMarkup("JointJS Diagram Formatter"),
  field_types: [
    "jointjs_field"
  ],
)]
class JointJSFieldFormatter extends FormatterBase
{

  /**
   * {@inheritdoc}
   */
  public function viewElements(FieldItemListInterface $items, $langcode)
  {
    $elements = [];

    foreach ($items as $delta => $item) {
      $elements[$delta] = [
        '#theme' => 'jointjs_diagram',
        '#diagram_data' => $item->value,
        '#attached' => [
          'library' => ['jointjs_field/jointjs.viewer'],
        ],
        '#attributes' => [
          'class' => ['jointjs-viewer'],
        ],
      ];
    }

    return $elements;
  }
}
