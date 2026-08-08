import { PartialType } from '@nestjs/swagger';
import { CreateOwnArticleDto } from './create-own-article.dto';

export class UpdateOwnArticleDto extends PartialType(CreateOwnArticleDto) {}
