import type { CropPlanTemplate } from '../types';
import { cannabisMotherTemplate } from './cannabis-mother';
import { hassAvocadoTemplate } from './hass-avocado';

export const cropPlanTemplates: CropPlanTemplate[] = [
  cannabisMotherTemplate,
  hassAvocadoTemplate,
];

export function getTemplate(id: string): CropPlanTemplate | undefined {
  return cropPlanTemplates.find((template) => template.id === id);
}

export function listTemplates(): CropPlanTemplate[] {
  return cropPlanTemplates;
}
