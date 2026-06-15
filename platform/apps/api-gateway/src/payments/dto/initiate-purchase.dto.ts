/**
 * DTO for initiating a purchase.
 * Validates item ID, payment method, and optional currency.
 *
 * Requirements: 7.1, 7.5
 */

import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  Matches,
} from 'class-validator';

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  GOOGLE_PAY = 'google_pay',
  APPLE_PAY = 'apple_pay',
}

export class InitiatePurchaseDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be one of: credit_card, debit_card, paypal, google_pay, apple_pay',
  })
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a valid ISO 4217 code (e.g., USD, EUR)' })
  currency?: string = 'USD';
}
