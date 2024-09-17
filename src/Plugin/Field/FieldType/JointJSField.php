<?php

namespace Drupal\jointjs_field\Plugin\Field\FieldType;

use Drupal\Core\Field\FieldItemBase;
use Drupal\Core\TypedData\DataDefinition;
use Drupal\Core\Field\FieldStorageDefinitionInterface;

/**
 * Plugin implementation of the 'jointjs_field' field type.
 *
 * @FieldType(
 *   id = "jointjs_field",
 *   label = @Translation("JointJS Diagram"),
 *   description = @Translation("Field type for JointJS diagrams."),
 *   default_widget = "jointjs_field_widget",
 *   default_formatter = "jointjs_field_formatter"
 * )
 */
class JointJSField extends FieldItemBase
{

    /**
     * {@inheritdoc}
     */
    public static function propertyDefinitions(FieldStorageDefinitionInterface $field_definition)
    {
        $properties['value'] = DataDefinition::create('string')
            ->setLabel(t('JointJS Diagram'))
            ->setDescription(t('The diagram data for JointJS.'))
            ->setRequired(FALSE);

        return $properties;
    }

    /**
     * {@inheritdoc}
     */
    public static function schema(FieldStorageDefinitionInterface $field_definition)
    {
        return [
            'columns' => [
                'value' => [
                    'type' => 'text',
                    'size' => 'big',
                    'not null' => FALSE,
                ],
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function isEmpty()
    {
        $value = $this->get('value')->getValue();
        return $value === NULL || $value === '';
    }
}
